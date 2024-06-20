class RunPlugin {
  apply(comiler) {
    // 在此插件里可以监听run这个钩子
    comiler.hooks.run.tap("RunPlugin", () => {
      console.log("run:开始编译")
    })
  }
}
module.exports = RunPlugin;