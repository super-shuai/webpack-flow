let fs = require("fs");
let types = require("babel-types");
let parser = require("@babel/parser");
let traverse = require("@babel/traverse").default;
let generator = require("@babel/generator").default;
const path = require("path");

let baseDir = toUnixPath(process.cwd()); // \ => /

function toUnixPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

class Complication {
  constructor(options) {
    this.options = options;
    this.modules = []; // 存放着本次编译生产所有的模块 所有的入口产出的模块
    this.chunks = []; // 本次编译组装出的代码块的数组
    this.assets = {}; // 产出的资源，key是文件名，值是文件内容
    this.files = []; // 本次打包出来的文件
    this.fileDependencies = [] // 本次编译依赖的文件或者说是模块
  }

  build(callback) {
    // 五、根据配置中的entry找出入口文件

    let entry = {};
    if(typeof this.options.entry === "string") {
      entry.main = this.options.entry;
    } else {
      entry = this.options.entry;
    }
    for(let entryName in entry) {
      const entryFilePath = path.posix.join(baseDir, entry[entryName]);
      this.fileDependencies.push(entryFilePath)
      // 六、从入口文件出发，调用所有的配置loader对模块进行编译，buildModule方法
      let entryModule = this.buildModule(entryName,entryFilePath)

      // 八、根据入口和模块之间的依赖，组装成一个个包含多个模块的chunk
      let chunk = {
        name: entryName,
        entryModule,
        modules: this.modules.filter((item) => item.name.includes(entryName)),
      }
      this.chunks.push(chunk)
    }

    // 九、再把每个chunk转换成一个单独的文件加入到输出列表
    this.chunks.forEach((chunk) => {
      let filename = this.options.output.filename.replace("[name]", chunk.name);
      this.assets[filename] = getSource(chunk)
    });

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

  buildModule(name, modulePath){
    // 六、从入口文件出发，调用所有配置的loader对模块进行编译
      ///1.读取文件模块内容
    let sourceCode = fs.readFileSync(modulePath, 'utf8');
    let { rules } = this.options.module;
    let loaders = [];
      ///2.取出所有loader
    rules.forEach(rule => {
      let { test } = rule
      if(modulePath.match(test)){
        loaders.push(...rule.use)
      }
    });
      /// 3.加载所有loader，从右到左
    sourceCode = loaders.reduceRight((sourceCode, loader) => {
      return require(loader)(sourceCode)
    },sourceCode)

      /// 当前模块的模块ID
    let moduleId = "./" + path.posix.relative(baseDir,modulePath);
    let module = {
      id: moduleId,
      dependencies: [],
      name: [name] /// name是模块所属的代码块的名称，若果一个模块属于多个代码块，那么name就是一个数组
    }

    let ast = parser.parse(sourceCode, {sourceType: "module"})
    traverse(ast, {
      CallExpression: ({node}) => {
        if(node.callee.name === "require") {
          let depModuleName = node.arguments[0].value;  // ./title
          let dirname = path.posix.dirname(modulePath); // src
          ///C:\aproject\zhufengwebpack202108\4.flow\src\title.js
          let depModulePath = path.posix.join(dirname, depModuleName);
          let extensions = this.options.resolve.extensions;
          depModulePath = tryExtensions(depModulePath, extensions)
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

      let existModule = this.modules.find((item) => item.id === depModuleId);
      if (existModule) {
        existModule.name.push(name)
      } else {
        let depModule = this.buildModule(name, depModulePath);
        this.modules.push(depModule)
      }
    })

    return module;
  }
}

function tryExtensions(modulePath, extensions) {
  if (fs.existsSync(modulePath)) {
    return modulePath;
  }
  for (let i = 0; i < extensions.length; i++) {
    let filePath = modulePath + extensions[i];
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  throw new Error(`${modulePath}没找到`);
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

module.exports = Complication;