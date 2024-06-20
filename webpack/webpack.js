const Compiler = require("./Compiler");

function webpack (options) {
  // 一、初始化参数: 从配置文件中和shell语句中读取合并参数，得出最终的配置对象
  let argv = process.argv.slice(2)
  let shellOptions = argv.reduce((shellOptions,options) => {
    const [key, value] = options.split('=')
    shellOptions[key.slice(2)] = value
    return shellOptions
  }, {})
  let finalOptions = { ...options, ...shellOptions };

  // 二、初始化Compiler对象
  let compiler = new Compiler(finalOptions)

  // 三、加载所有配置的插件
  const { plugins } = finalOptions;
  for(let plugin of plugins) {
    plugin.apply(compiler);
  }

  // 返回compiler
  return compiler;
}

module.exports = webpack