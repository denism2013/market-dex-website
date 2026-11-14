"""Build compact rule-monitor files from already collected prices; zero external requests."""
import json
from pathlib import Path
from rulebook_core import RULES,UNSUPPORTED,analyze
ROOT=Path(__file__).resolve().parents[1]
def main():
 d=json.loads((ROOT/'data/latest.json').read_text());extra=ROOT/'data/extra-tickers.json'
 if extra.exists():
  for s,x in json.loads(extra.read_text()).items():
   if s not in d['markets'] or x.get('as_of','')>d['markets'][s].get('as_of',''):d['markets'][s]=x
 target=ROOT/'data/rules';target.mkdir(exist_ok=True);symbols=[]
 for symbol,x in d['markets'].items():
  result=analyze(symbol,x);(target/(symbol+'.json')).write_text(json.dumps(result,allow_nan=False,separators=(',',':'))+'\n');symbols.append({'symbol':symbol,'name':x.get('name',symbol),'asset_class':x.get('asset_class'),'as_of':result.get('as_of'),'sessions':result.get('sessions'),'status':result['status']})
 manifest={'schema':1,'source_snapshot_generated_at':d['generated_at'],'symbols':symbols,'available_rules':RULES,'unavailable_rules':UNSUPPORTED,'method':'Close t signal; entry close t+1; fixed-horizon exit h observed sessions later. Same-horizon event windows do not overlap. Wins are direction-correct underlying moves, before costs, not trade profitability. Zero returns are not wins. RSI exit-rule results separately include 10 bps per side. Baseline uses all eligible dates and overlaps. Wilson intervals are descriptive binomial intervals, not dependence- or selection-adjusted probabilities. Fixed final 30% holdout; no parameters fitted. Present holdings and unadjusted prices limit inference. Horizons are observed bars, not a verified exchange calendar. No claim of a validated edge.'}
 (ROOT/'data/rulebook.json').write_text(json.dumps(manifest,allow_nan=False,separators=(',',':'))+'\n')
if __name__=='__main__':main()
