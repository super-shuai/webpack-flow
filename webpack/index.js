const path = require("path");
const resolve = dir => {
  return path.resolve(__dirname, "..", dir)
}
const webpack = require("./webpack")
const options = require(resolve("webpack.config.js"))
const compiler = webpack(options);

// 四、执行Compiler对象的run方法开始执行编译
compiler.run((err,stats) => {
  if(err){
    console.log(err)
  }
  console.log(stats)
})