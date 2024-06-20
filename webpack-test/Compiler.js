const fs = require("fs");
const path = require("path");
const { SyncHook } = require('tapable')
const Complication = require('./Complication')
class Compiler {
  constructor(options) {
    this.options = options
    this.hooks = {
      run: new SyncHook(),
      done: new SyncHook()
    }
  }

  run(callback){
    // 开始编译调用call方法
    this.hooks.run.call()
    const onCompiled = (err, stats, fileDependencies) => {
      callback(err, stats)

      //十、在确定好输出内容后，根据配置确定输出的路径和文件名，把文件内容写入到文件系统
      for(let filename in stats.assets) {
        let filePath = path.join(this.options.output.path, filename)
        fs.writeFileSync(filePath, stats.assets[filename], 'utf8')
      }

      fileDependencies.forEach(fileDependency => {
         // 监听依赖的文件变化，如果依赖的文件变化后会开始一次新的编译，一次新的compilation被创建
         fs.watch(fileDependency, () => this.compile(onCompiled))

         this.hooks.done.call();  ///在编译完成时触发done钩子执行 
      });
    }
    this.compile(onCompiled)
  }

  // 四.1 初始化complication对象，并且调用build方法
  compile(callback) {
    const compilation = new Complication(this.options)
    compilation.build(callback)
  }
}

module.exports = Compiler