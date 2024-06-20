// 引入webpac
const webpack = require('./webpack')

//读取配置
const options = require("../webpack.config")

// 初始化webpack对象, 返回compiler对象
const compiler = new webpack(options)

// 四、执行compiler的run方法
compiler.run((err, stats) => {
  console.log(stats)
})
