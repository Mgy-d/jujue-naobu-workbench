"""Prepare a local numeric integration slice, never a complete questionnaire or public anonymized dataset."""
from pathlib import Path
import argparse,csv,hashlib,io,json,math,statistics,zipfile

SOURCE_SHA256='2e0b199fcbd906781f65bfa8bf1843705d7b2ecac7ae0dcc7be97384a1b4e305'

def prepare_case(archive:Path,output:Path):
    archive=Path(archive);output=Path(output)
    if output.exists():raise FileExistsError('Destination exists; refusing to overwrite it.')
    with zipfile.ZipFile(archive) as z:
        if len([i for i in z.infolist() if i.filename=='600.csv'])!=1:raise ValueError('Expected exactly one 600.csv entry.')
        entry=z.getinfo('600.csv')
        if entry.file_size>10*1024*1024:raise ValueError('Input exceeds 10 MiB.')
        raw=z.read(entry)
    if hashlib.sha256(raw).hexdigest()!=SOURCE_SHA256:raise ValueError('Source hash mismatch; review the new version before preparing it.')
    records=list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))))
    if not records or len(records[0])!=149:raise ValueError('Expected the 149-column export; inspect a different version before adapting it.')
    headers,rows=records[0],records[1:]
    if not rows or any(len(row)!=len(headers) for row in rows):raise ValueError('Inconsistent or empty CSV rows; no output written.')
    kept=[];dictionary=[];expected={}
    for index,title in enumerate(headers):
        values=[row[index] for row in rows];numbers=[];reason=''
        if index<20:reason='export index or platform metadata'
        elif title in ['学校以及学院','选择你所在家乡城市']:reason='institution or detailed home location'
        else:
            for value in values:
                if not value.strip():continue
                try:
                    number=float(value)
                    if not math.isfinite(number):raise ValueError('non-finite')
                    numbers.append(number)
                except ValueError:reason='categorical, free text, or non-finite value; excluded from numeric slice';break
            if not numbers and not reason:reason='no observed numeric value'
        field=f'f{index:03d}'
        dictionary.append({'sourceColumnIndex':index,'sourceHeader':title,'field':field,'included':not bool(reason),'reason':reason,'measurementLevel':'unconfirmed','missingPolicy':'empty values preserved; no imputation or inferred missing reason'})
        if reason:continue
        kept.append((index,field))
        expected[field]={'count':len(numbers),'missing':sum(not v.strip() for v in values),'mean':statistics.mean(numbers),'median':statistics.median(numbers),'min':min(numbers),'max':max(numbers),'sampleStd':statistics.stdev(numbers) if len(numbers)>1 else None}
    if not kept:raise ValueError('No numeric business columns; no output written.')
    stream=io.StringIO(newline='');writer=csv.writer(stream,lineterminator='\n');writer.writerow(['case_row']+[field for _,field in kept])
    for n,row in enumerate(rows,1):writer.writerow([f'case_row_{n:04d}']+[row[i] for i,_ in kept])
    payload=stream.getvalue().encode('utf-8')
    manifest={'schema':'parttime-case-candidate/v1','caseId':'college-parttime-600-numeric-v1','status':'candidate-awaiting-backend-confirmation','sourceEntry':'600.csv','sourceSha256':hashlib.sha256(raw).hexdigest(),'sourceRepository':'https://github.com/spiritysdx/Factors-influencing-college-students-satisfaction-with-part-time-jobs-PCA-analysis','dataset':'numeric-input.csv','datasetSha256':hashlib.sha256(payload).hexdigest(),'rows':len(rows),'sourceColumns':len(headers),'numericBusinessColumns':len(kept),'technicalRowColumn':'case_row','rowPolicy':'all source rows preserved in source order','scope':'Local numeric parser/statistics regression only; not complete G2, not PCA, not a formal G3 result','privacy':'Direct platform identifiers and text columns excluded; not certified anonymous; do not publish or send to a model. Public demonstration should use aggregates or explicitly synthetic records.'}
    output.mkdir(parents=True)
    (output/'numeric-input.csv').write_bytes(payload)
    for name,data in [('manifest.json',manifest),('field-map.json',dictionary),('expected.json',{'boundary':'Python standard-library reference for parser regression, not business interpretation or adopted results','fields':expected})]:
        (output/name).write_text(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    (output/'README.md').write_text('''# 大学生兼职案例：数值字段联调候选包

此包仅供本机前后端解析/统计对齐；后端尚未确认该版本。numeric-input.csv 是原 600 版的数值业务字段切片，保留全部行与空值，没有填零、删行或重新解释答案。它不是完整问卷，也不能用来复现原报告的 PCA。

manifest.json 固定来源与派生文件 SHA-256；field-map.json 逐列记录保留/排除及原字段位置；expected.json 是标准库算出的技术对照值，不能当作适用统计方法、真实研究结论或正式成果。

删除直接标识与文本字段不等于彻底匿名。CSV 不用于公开发布或发给模型。展示应使用汇总或另行明确标注的合成记录；不得把历史答卷说成本平台刚回收。

若某字段实际上是分类编码，不能仅因可转成数字就解释其均值；测量层级和缺失原因尚待逐项确认。原压缩包、原问卷和原数据不改动。
''',encoding='utf-8')
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--archive',required=True,type=Path);parser.add_argument('--output',required=True,type=Path);args=parser.parse_args()
    report=prepare_case(args.archive,args.output)
    print(json.dumps({k:report[k] for k in ['status','rows','numericBusinessColumns','sourceSha256','datasetSha256']},ensure_ascii=False))
