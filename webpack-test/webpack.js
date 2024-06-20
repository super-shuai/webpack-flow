const Compiler = require('./Compiler')
function webpack(options) {
  // 一、初始化配置参数与shell命令语句合并
  const argv = process.argv.slice(2)
  let shellOptions = argv.reduce((shellOptions, options) => {
    // --mode=dev
    cosnt [key, value] = options.split('=')
    shellOptions[key.slice(2)] = value
  }, {})
  let finalOptions = { ...options, ...shellOptions }

  // 二、用上一步的参数初始化Compiler对象
  const compiler = new Compiler(finalOptions)

  // 三、加载所有初始化插件
  const { plugins } = finalOptions
  plugins.map((plugin) => {
    plugin.apply(compiler)
  })

  // 返回compiler对象
  return compiler
}

module.exports = webpack