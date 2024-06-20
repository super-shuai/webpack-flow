let { SyncHook } = require("tapable");
let fs = require("fs");
let path = require("path");
let Complication = require("./Complication");

class Compiler {
  constructor(options) {
    this.options = options
    this.hooks = {
      run: new SyncHook(), // 注册tag事件，会在开始编译的时候触发
      done: new SyncHook(), //会在结束编译的时候触发
    }
  }
  // compiler对象中的run方法
  run(callback) {
    this.hooks.run.call()   //编译开始前触发run钩子执行
    // 在编译过程中会收集所有的依赖模块或者说文件
    const onCompiled = (err, stats, fileDependencies) => {
      /// stats指的是统计信息 modules chunks assets files
      console.log(stats)

      //十、在确定好输出内容后，根据配置确定输出的路径和文件名，把文件内容写入到文件系统
      for(let filename in stats.assets) {
        let filePath = path.join(this.options.output.path, filename)
        fs.writeFileSync(filePath, stats.assets[filename], 'utf8')
      }
      
      callback(err,{ toJson: () => stats })

      /// fileDependencies 是用来存储依赖的数组
      fileDependencies.forEach(fileDependency => {
        // 监听依赖的文件变化，如果依赖的文件变化后会开始一次新的编译，一次新的compilation被创建
        fs.watch(fileDependency, () => this.compile(onCompiled))

        this.hooks.done.call();  ///在编译完成时触发done钩子执行

        /**
         * 在webpack5以前全部重新编译，比较慢。webpack5之前有一些缓存工具cache。hardsoure,dlplugin
         * 在webpack5以后内置了缓存机制，cache功能模块，如果模块变了，重新编译该模块，如果没有变化的直接用上次的缓存
        */
      });
    }

    this.compile(onCompiled)
  }

  // 开启一次新的编译
  compile(callback) {
    // 初始化 complication
    const complication = new Complication(this.options);
    complication.build(callback)
  }
}

module.exports = Compiler

/**
 * Compiler和Compilation的区别
 * Compiler 模块是 webpack 的主要引擎，它创建出一个 compilation 实例。 
 * 它扩展自 Tapable 类，用来注册和调用插件。
 * 
 * compilation 实例能够访问所有的模块和它们的依赖（大部分是循环依赖）。 
 * 它会对应用程序的依赖图中所有模块， 进行字面上的编译(literal compilation)。
 * 在编译阶段，模块会被加载(load)、封存(seal)、优化(optimize)、 分块(chunk)、哈希(hash)和重新创建(restore)。
 * 
 * 一句话说Compiler负责流程编译，Compilation负责模块编译
*/