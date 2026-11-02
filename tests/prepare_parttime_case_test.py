import unittest,tempfile,zipfile,csv,io,json,importlib.util,os,hashlib
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location('prepare_case',Path(__file__).resolve().parents[1]/'scripts/prepare_parttime_case.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class PrepareCaseTests(unittest.TestCase):
 def archive(self,root):
  headers=['metadata'+str(i) for i in range(149)];headers[0]='';headers[20]='请选择你的性别';headers[21]='学校以及学院';headers[22]='年级';headers[23]='选择你所在家乡城市';headers[24]='其他说明'
  rows=[]
  for n in range(2):
   row=['1']*149;row[1]='private-user';row[10]='192.0.2.1';row[20]='女';row[21]='某个具体院校';row[23]='某个具体地址';row[24]='name@example.test';row[22]=str(n+1);row[25]='' if n==0 else '1';row[26]='NaN' if n==0 else '1';rows.append(row)
  stream=io.StringIO(newline='');writer=csv.writer(stream);writer.writerow(headers);writer.writerows(rows)
  archive=root/'sample.zip'
  with zipfile.ZipFile(archive,'w') as z:z.writestr('600.csv',stream.getvalue().encode('utf-8-sig'));z.writestr('../unsafe.txt','do not extract')
  pin=patch.object(module,'SOURCE_SHA256',hashlib.sha256(stream.getvalue().encode('utf-8-sig')).hexdigest(),create=True);pin.start();self.addCleanup(pin.stop)
  return archive
 def test_rows_and_empty_values_preserved_identifiers_excluded_and_output_reproducible(self):
  with tempfile.TemporaryDirectory(dir=os.environ.get('PARTTIME_CASE_TEST_TMP')) as tmp:
   root=Path(tmp);archive=self.archive(root);a=module.prepare_case(archive,root/'one');b=module.prepare_case(archive,root/'two')
   self.assertEqual(a['rows'],2);self.assertEqual(a['datasetSha256'],b['datasetSha256'])
   data=list(csv.DictReader(io.StringIO((root/'one/numeric-input.csv').read_text('utf-8'))))
   self.assertEqual(len(data),2);self.assertEqual(data[0]['f025'],'');self.assertNotIn('f026',data[0]);self.assertNotIn('f021',data[0])
   text=''.join(p.read_text('utf-8') for p in (root/'one').iterdir())
   for private in ['private-user','192.0.2.1','某个具体院校','某个具体地址','name@example.test']:self.assertNotIn(private,text)
   expected=json.loads((root/'one/expected.json').read_text('utf-8'));self.assertEqual(expected['fields']['f022']['mean'],1.5);self.assertEqual(expected['fields']['f025']['missing'],1)
   self.assertFalse((root/'unsafe.txt').exists());self.assertEqual(a['status'],'candidate-awaiting-backend-confirmation')
 def test_existing_destination_and_invalid_rows_do_not_overwrite(self):
  with tempfile.TemporaryDirectory(dir=os.environ.get('PARTTIME_CASE_TEST_TMP')) as tmp:
   root=Path(tmp);archive=self.archive(root);dest=root/'existing';dest.mkdir();(dest/'keep').write_text('keep')
   with self.assertRaises(FileExistsError):module.prepare_case(archive,dest)
   self.assertEqual((dest/'keep').read_text(),'keep')
   bad=root/'bad.zip'
   with zipfile.ZipFile(bad,'w') as z:z.writestr('600.csv','a,b\n1\n')
   with self.assertRaises(ValueError):module.prepare_case(bad,root/'invalid')
   self.assertFalse((root/'invalid').exists())
 def test_same_name_and_width_but_changed_source_is_rejected(self):
  with tempfile.TemporaryDirectory(dir=os.environ.get('PARTTIME_CASE_TEST_TMP')) as tmp:
   root=Path(tmp);original=self.archive(root)
   with zipfile.ZipFile(original) as z:raw=z.read('600.csv')
   wrong=root/'wrong.zip'
   with zipfile.ZipFile(wrong,'w') as z:z.writestr('600.csv',raw.decode('utf-8-sig').replace('请选择你的性别','手机号').replace('女','2025550100').encode('utf-8-sig'))
   with self.assertRaisesRegex(ValueError,'hash'):module.prepare_case(wrong,root/'wrong-output')
   self.assertFalse((root/'wrong-output').exists())
if __name__=='__main__':unittest.main()
