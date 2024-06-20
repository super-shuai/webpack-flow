let fs = require("fs");
const path = require("path");
let types = require("babel-types");
let parser = require("@babel/parser");
let traverse = require("@babel/traverse").default;
let generator = require("@babel/generator").default;

const baseDir = toUnixPath(process.cwd())
function toUnixPath(filePath) {
  return filePath.replace(/\\/g,'/')
}

class Complication {
  constructor(options) {
    this.options = options // 配置
    this.chunks = [] // 本次编译组装出的代码块
    this.modules = [] // 存放着本次编译生产出的所有模块
    this.assets = {} // 产出的资源，key是文件名，值是文件内容
    this.files = [] // 本次打包出来的文件
    this.fileDependencies = [] // 本次依赖的文件
  }

  build(callback) {
    // 五、根据配置找到入口文件entry
    let entryFile = {}
    const { entry } = this.options
    if(typeof entry === "string") {
      entryFile.main = entry
    } else {
      entryFile = entry
    }

    // 六、从入口出发，调用所有配置的loader对模块进行编译
    for(let entryName in entryFile) {
      // 文件相对路径
      const entryPath = path.posix.join(baseDir, entryFile[entryName])
      const entryModule = this.buildModule(entryName,entryPath)
      this.modules.push(entryModule)

      // 八、根据入口和模块之间的依赖，组装成一个个包含多个模块的chunk
      let chunk = {
        name: entryName,
        entryModule,
        modules: this.modules.filter((item) => item.name.includes(entryName)) // modules是包含哪些模块，即哪些代码块属于这个chunk
      }
      this.chunks.push(chunk)
    }

    // 九、再把每个chunk转换成一个单独的文件加入到输出列表
    this.chunks.forEach((chunk) => {
      let filename = this.options.output.filename.replace('[name]', chunk.name)
      this.files.push(filename)
      this.assets[filename] = getSource(chunk) 
    })

    callback(
      null,
      {
        chunks: this.chunks,
        modules: this.modules,
        assets: this.assets,
        files: this.files
      },
      this.fileDependencies
    )
  }

  buildModule(name, modulePath) {
    // 读取文件内容
    let sourceCode = fs.readFileSync(modulePath, 'utf-8')

    // 取出所有loader
    let { rules } = this.options.module
    const loaders = []
    rules.forEach(rule => {
      if(modulePath.match(rule.test)){
        loaders.push(...rule.use)
      }
    });
    
    // 加载所有的loader,从左到右
    sourceCode = loaders.reduceRight((sourceCode, loader) => {
      return require(loader)(sourceCode)
    },sourceCode)


    // 当前模块id 
    const moduleId = './' + path.posix.relative(baseDir, modulePath)
    const module = {
      id: moduleId,
      dependencies: [],
      name: [name]
    }

    // 把源码生成语法树
    let ast = parser.parse(sourceCode, {sourceType: "module"})

    traverse(ast,{
      CallExpression: ({node}) => {
        if(node.callee.name === "require"){
          let depModuleName = node.arguments[0].value;  // ./title
          
          let depModulePath
          // 判断是绝对路径还是相对路径
          if(depModuleName.startsWith('.')) {
            let dirname = path.posix.dirname(modulePath); // src
            depModulePath = path.posix.join(dirname, depModuleName);
            let extensions = this.options.resolve.extensions;
            depModulePath = tryExtensions(depModulePath, extensions)
          } else {
            depModulePath = require.resolve(depModuleName)
          }

          this.fileDependencies.push(depModulePath)
          /// 生成此模块的模块ID
          let depModuleId = "./" + path.posix.relative(baseDir, depModulePath);
          /// 把依赖的模块名换成模块ID
          node.arguments = [types.stringLiteral(depModuleId)]; // ./title => ./src/title.js
          /// 把依赖的模块ID和依赖模块的路径放置到当前的模块的依赖数组中
          module.dependencies.push({
            depModuleId,
            depModulePath
          })
        }
      }
    })

    let {code} = generator(ast)
    module._soure = code;
    // 七、再递归本步骤直到所有入口依赖的文件都经过了本步骤的处理
    module.dependencies.forEach(({depModuleId, depModulePath }) => {
      // 判断此依赖的模块是否已经打包过了或者说编译过了
      let existModule = this.modules.find((item) => item.id === depModuleId)
      if(existModule) {
        existModule.name.push(name)
      } else {
        let depModule = this.buildModule(name, depModulePath)
        this.modules.push(depModule)
      }
    })

    return module
  }
}

function tryExtensions(modulePath, extensions) {
  if(fs.existsSync(modulePath)) {
    return modulePath
  }
  for(let i=0; i<extensions.length; i++) {
    let filePath = modulePath + extensions[i]
    if(fs.existsSync(filePath)){
      return filePath
    }
  }
  throw new Error(`${modulePath} not paths`)
}

function getSource(chunk) {
  return `
  (() => {
   var modules = {
     ${chunk.modules.map(
       (module) => `
       "${module.id}": (module) => {
         ${module._source}
       },
     `
     )}  
   };
   var cache = {};
   function require(moduleId) {
     var cachedModule = cache[moduleId];
     if (cachedModule !== undefined) {
       return cachedModule.exports;
     }
     var module = (cache[moduleId] = {
       exports: {},
     });
     modules[moduleId](module, module.exports, require);
     return module.exports;
   }
   var exports ={};
   ${chunk.entryModule._source}
 })();
  `;
}


module.exports = Complication