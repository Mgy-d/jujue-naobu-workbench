# 大学生兼职案例的联调准备

当前状态：`600.csv` 是建议基线，等待后端确认。此脚本只生成本机数值字段联调切片，不改业务页面默认案例、不自动创建或确认 G1/G2/G3/G4，不复现 PCA，不发布历史答卷。

来源：https://github.com/spiritysdx/Factors-influencing-college-students-satisfaction-with-part-time-jobs-PCA-analysis 。原文件 SHA-256：`2e0b199fcbd906781f65bfa8bf1843705d7b2ecac7ae0dcc7be97384a1b4e305`。

## 重复生成

使用 Python 标准库，无新增依赖。输出目录必须尚不存在：

```powershell
python -B scripts/prepare_parttime_case.py --archive '压缩包完整路径' --output 'D:/Codex/outputs/parttime-case-new'
```

先核对源文件固定 SHA-256；同名但内容不同会直接拒绝，不允许静默切换来源或版本。只读取 zip 内 `600.csv`，不解压 `.git`、exe 或 Notebook。保留所有行与空值；前 20 列平台元数据/导出索引、院校/家乡明细、非数值/非有限数值字段不进入数值切片，排除原因逐列留痕。字段按原列位置命名 fNNN，没有重新猜题号或编码。生成：

- `numeric-input.csv`：数值切片 + 新的技术行号，不是完整问卷或正式清洗数据。
- `field-map.json`：原表头/位置、派生字段与排除原因，测量层级均保留未确认。
- `expected.json`：Python 标准库计算的解析回归对照，不能代替业务统计方法审核或正式成果。
- `manifest.json`：来源/派生文件哈希、样本行数、处理边界，状态始终是待后端确认的候选。

实际附件生成结果为 600 行、99 个数值业务字段。派生 CSV SHA-256 为 `4fdeb41f1048820508c57515e3109c67347e613a82555c3890ea0029dfef35a9`；若双方要用这份切片，需要同时对齐源文件与派生文件哈希，不能拿它和全量 149 列或 549 行版本混比。

## 验证与边界

```powershell
$env:PARTTIME_CASE_TEST_TMP = 'D:/Codex/outputs/parttime-tests'
New-Item -ItemType Directory -Force $env:PARTTIME_CASE_TEST_TMP | Out-Null
python -B tests/prepare_parttime_case_test.py
```

测试覆盖保留行/空值、稳定哈希、排除直接标识与自由文本、非有限数字、拒绝覆盖既有目录、拒绝异常行，以及不解压 zip 其他条目。

2026-10-29 本机实际页面已验证此候选切片的上传、真实 Docker 统计、结果下载、哈希和数值核对、刷新恢复与报告来源草稿保存。这里只证明现有本机沙箱链路，不代表智能体 G3、正常登录/团队权限、正式项目保存或业务研究结论通过。

去掉直接标识不等于彻底匿名。派生 CSV、原始答卷、zip、完整运行结果和截图留仓库外，不公开、不发给模型；展示使用汇总信息或明确标注的合成记录。PCA 12 变量的编码与方法另行核对；分类码即使是数字也不能直接解释其均值。原问卷题库版本、跳题和缺失码含义尚待对齐。

## G2 题项来源的新增核对

原导出表的题号映射行实际含 50 个题组、129 个展开字段；最大题号 Q52，Q21/Q50 没有对应导出字段。文稿的“52道题”不等于当前 CSV 可以恢复52道完整题。Q18 的重复题干在600版被导出为 .1 后缀，需按原题号区分。题型、跳转与缺失原因仍待来源版本确认，不新增缺失题、不得凭空认定对应问卷已固定。
