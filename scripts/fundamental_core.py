"""Conservative standard-US-GAAP normalization. Never infer absent tags or mix periods."""
import math
from datetime import date
TAGS={
'revenue':['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'],
'cost_of_revenue':['CostOfRevenue','CostOfGoodsAndServicesSold','CostOfGoodsSold'],
'gross_profit':['GrossProfit'],'research_development':['ResearchAndDevelopmentExpense'],
'selling_general_admin':['SellingGeneralAndAdministrativeExpense'],'operating_income':['OperatingIncomeLoss'],
'interest_expense':['InterestExpenseNonOperating','InterestExpense'],'tax_expense':['IncomeTaxExpenseBenefit'],
'net_income':['NetIncomeLoss','ProfitLoss'],'eps_diluted':['EarningsPerShareDiluted'],
'operating_cash':['NetCashProvidedByUsedInOperatingActivities'],
'capex':['PaymentsToAcquirePropertyPlantAndEquipment'],'depreciation_amortization':['DepreciationDepletionAndAmortization','DepreciationDepletionAndAmortizationPropertyPlantAndEquipment'],
'cash_dividends':['PaymentsOfDividendsCommonStock','PaymentsOfDividends'],
'dividend_per_share':['CommonStockDividendsPerShareDeclared','CommonStockDividendsPerShareCashPaid'],
'assets':['Assets'],'current_assets':['AssetsCurrent'],'cash':['CashAndCashEquivalentsAtCarryingValue'],
'receivables':['AccountsReceivableNetCurrent'],'inventory':['InventoryNet'],
'property_plant_equipment':['PropertyPlantAndEquipmentNet'],'goodwill':['Goodwill'],
'liabilities':['Liabilities'],'current_liabilities':['LiabilitiesCurrent'],
'long_term_debt_current':['LongTermDebtCurrent'],'long_term_debt_noncurrent':['LongTermDebtNoncurrent'],
'equity':['StockholdersEquity'],'shares_outstanding':['CommonStockSharesOutstanding']}
INSTANT={'assets','current_assets','cash','receivables','inventory','property_plant_equipment','goodwill','liabilities','current_liabilities','long_term_debt_current','long_term_debt_noncurrent','equity','shares_outstanding'}
def finite(v):return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
def unit(key):return 'shares' if key=='shares_outstanding' else 'USD/shares' if key in ['eps_diluted','dividend_per_share'] else 'USD'
def rows(facts,key,today=None):
 today=today or date.today();out=[]
 for tag in TAGS[key]:
  for r in facts.get('facts',{}).get('us-gaap',{}).get(tag,{}).get('units',{}).get(unit(key),[]):
   try:
    end=date.fromisoformat(r['end']);filed=date.fromisoformat(r['filed']);start=date.fromisoformat(r['start']) if r.get('start') else None
    if not finite(r['val']) or end>today or filed>today or filed<end or r.get('form') not in ['10-K','10-Q','10-K/A','10-Q/A'] or not r.get('accn'):continue
    if key in INSTANT and start is not None:continue
    out.append({**r,'tag':tag,'unit':unit(key)})
   except (ValueError,KeyError,TypeError):continue
 return out
def filing_url(cik,accn):return f'https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accn.replace("-","")}/{accn}-index.htm'
def anchor_periods(facts,kind,today=None):
 candidates=[]
 for key in ['revenue','net_income','operating_cash']:
  for r in rows(facts,key,today):
   if not r.get('start'):continue
   days=(date.fromisoformat(r['end'])-date.fromisoformat(r['start'])).days
   if kind=='annual' and 330<=days<=400 and r['form'].startswith('10-K') or kind=='quarterly' and 60<=days<=120:
    candidates.append(r)
 # A single filing accession anchors every field for that exact period.
 selected={}
 for r in candidates:
  key=(r['start'],r['end'])
  if key not in selected or (r['filed'],r['accn'])>(selected[key]['filed'],selected[key]['accn']):selected[key]=r
 return sorted(selected.values(),key=lambda r:r['end'],reverse=True)[:5 if kind=='annual' else 8]
def normalize_period(facts,anchor,today=None):
 values={};cik=facts['cik']
 for key in TAGS:
  candidates=[r for r in rows(facts,key,today) if r['end']==anchor['end'] and r['accn']==anchor['accn'] and (key in INSTANT or r.get('start')==anchor['start'])]
  # Conflicting values in one concept/period are not guessed.
  chosen=None
  for tag in TAGS[key]:
   group=[r for r in candidates if r['tag']==tag]
   unique={r['val'] for r in group}
   if len(unique)==1:chosen=group[0];break
   if len(unique)>1:break
  values[key]=None if chosen is None else {'value':chosen['val'],'tag':chosen['tag'],'unit':chosen['unit'],'start':chosen.get('start'),'end':chosen['end'],'filed':chosen['filed'],'accn':chosen['accn'],'source_url':filing_url(cik,chosen['accn'])}
 def val(k):return values[k]['value'] if values[k] else None
 def ratio(a,b):return a/b if a is not None and b is not None and b>0 else None
 fcf=val('operating_cash')-val('capex') if val('operating_cash') is not None and val('capex') is not None and val('capex')>=0 else None
 return {'start':anchor['start'],'end':anchor['end'],'filed':anchor['filed'],'form':anchor['form'],'accn':anchor['accn'],'source_url':filing_url(cik,anchor['accn']),'values':values,'ratios':{'gross_margin':ratio(val('gross_profit'),val('revenue')),'operating_margin':ratio(val('operating_income'),val('revenue')),'net_margin':ratio(val('net_income'),val('revenue')),'current_ratio':ratio(val('current_assets'),val('current_liabilities')),'liabilities_assets':ratio(val('liabilities'),val('assets')),'cash_assets':ratio(val('cash'),val('assets')),'cash_conversion':ratio(val('operating_cash'),val('net_income')),'fcf_margin':ratio(fcf,val('revenue'))},'ocf_less_capex':fcf,'missing':[k for k,v in values.items() if v is None]}
def normalize(facts,meta,today=None):
 if not isinstance(facts,dict) or not facts.get('cik') or not facts.get('facts'):raise ValueError('Invalid companyfacts export')
 annual=[normalize_period(facts,r,today) for r in anchor_periods(facts,'annual',today)];quarterly=[normalize_period(facts,r,today) for r in anchor_periods(facts,'quarterly',today)]
 for i,a in enumerate(annual):
  prev=annual[i+1] if i+1<len(annual) else None;a['growth']={}
  if prev and 330<=(date.fromisoformat(a['end'])-date.fromisoformat(prev['end'])).days<=400:
   for key in ['revenue','net_income','operating_cash']:
    x=a['values'][key];y=prev['values'][key];a['growth'][key]=x['value']/y['value']-1 if x and y and y['value']>0 else None
   ni=a['values']['net_income']
   for field,name in [('equity','return_on_average_equity'),('assets','return_on_average_assets')]:
    cur=a['values'][field];old=prev['values'][field];a['ratios'][name]=ni['value']/((cur['value']+old['value'])/2) if ni and cur and old and cur['value']>0 and old['value']>0 else None
   a['growth']['ocf_less_capex']=a['ocf_less_capex']/prev['ocf_less_capex']-1 if a['ocf_less_capex'] is not None and prev['ocf_less_capex'] is not None and prev['ocf_less_capex']>0 else None
 return {'schema':1,**meta,'cik':str(facts['cik']).zfill(10),'entity_name':facts.get('entityName',meta.get('name')),'status':'observed' if annual else 'quarterly_only' if quarterly else 'standard_tags_unavailable','annual':annual,'quarterly':quarterly,'note':'Standard US-GAAP consolidated tags only. Fields use the same accession and exact period; absent/custom tags remain missing. Annual and reported 3-month periods are separate; Q4 is not silently inferred. Current/restated filing facts, not a point-in-time backtest archive. OCF less capex is a cash-flow proxy, not complete FCFF or FCFE. This is a structured statement screen, not a complete filing audit.'}
