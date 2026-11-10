# PDF / PPTX 预览

在原成果弹窗内加载原文件，预览不修改原文件、不发送研究指令、不向第三方上传。

- PDF：pdfjs-dist 6.5.438，按页绘制，可翻页、缩放、下载；worker 与字库在本站部署。
- PPTX：@aiden0z/pptx-renderer 1.4.0，按原始版面绘制、翻页、下载；启用 ZIP 资源限制，关闭外部媒体与外部 PDF 兜底资源。不执行幻灯片链接。动画、特殊效果、字体和复杂图表可能与 PowerPoint 不一致。
- 两种预览按需加载，校验文件签名，预览上限 32MB。失败明确提示；关闭弹窗、切换文件或身份变化后清理旧任务与资源。
- 构建环境：本轮使用 Node 24.12.0。pdfjs-dist 6.5.438 的 Node engines 为 >=22.13.0 或 >=24；不要在不满足要求的 Node 版本下安装构建。部署后的浏览器不需要安装 Node。
- public/vendor/pdfjs-6.5.438 的字体、CMap、WASM 和许可证必须随构建部署，不替换为公网 CDN；public/vendor/pptx-renderer-1.4.0 保留上游及第三方许可证。

上游：https://github.com/mozilla/pdf.js ，https://github.com/aiden0z/pptx-renderer 。

本轮合成验证使用两页 PDF 和两页 PPTX，覆盖实际绘制、PDF 翻页缩放、PPTX 中文定位文字/形状/图片与翻页、404、延迟旧请求和身份变更。合成页面不代表真实会话文件已经验收。
