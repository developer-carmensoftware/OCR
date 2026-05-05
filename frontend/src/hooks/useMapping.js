import { useState, useEffect } from 'react';
import { fetchAccountCodes, fetchDepartments, fetchGLPrefixes } from '../lib/api/carmen';
import { suggestMapping, suggestPaymentTypes, saveMappingHistory } from '../lib/api/mapping';

const BANK_INFO = {
  'Bangkok Bank (BBL)': {
    name: 'ธนาคารกรุงเทพ จำกัด (มหาชน)',
    taxId: '0107536000374',
    address: '333 ถนนสีลม เขตบางรัก กรุงเทพฯ 10500',
  },
  'Kasikornbank (KBANK)': {
    name: 'บมจ. ธนาคารกสิกรไทย',
    taxId: '0107536000315',
    address: '400/22 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพมหานคร 10400',
  },
  'Siam Commercial Bank (SCB)': {
    name: 'ธนาคารไทยพาณิชย์ จํากัด (มหาชน)',
    taxId: '0107536000102',
    address: '9 ถนนรัชดาภิเษก เขตจตุจักร กรุงเทพฯ 10900',
  },
};

const OCR_BANK_MAP = {
  BBL: 'Bangkok Bank (BBL)',
  KBANK: 'Kasikornbank (KBANK)',
  SCB: 'Siam Commercial Bank (SCB)',
};

export function useMapping() {
  const [masterAccounts, setMasterAccounts] = useState([]);
  const [masterDepartments, setMasterDepartments] = useState([]);
  const [masterGLPrefixes, setMasterGLPrefixes] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  const [bank, setBank] = useState('');
  const [filePrefix, setFilePrefix] = useState('');
  const [fileSource, setFileSource] = useState('');
  const [description, setDescription] = useState('');

  const [company, setCompany] = useState({ name: '', taxId: '', branch: '', address: '' });

  const [mappings, setMappings] = useState({
    commission: { dept: '', acc: '' },
    tax: { dept: '', acc: '' },
    net: { dept: '', acc: '' }
  });

  const [paymentAmount, setPaymentAmount] = useState({});
  const [customPaymentTypes, setCustomPaymentTypes] = useState([]);
  const [newCustomType, setNewCustomType] = useState('');

  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);
  const [activeScan, setActiveScan] = useState({ paymentTypes: new Set(), commission: false, tax: false, net: false });
  const [modalConfig, setModalConfig] = useState({ show: false, title: '', message: '', type: 'info' });
  const [saving, setSaving] = useState(false);
  const [acceptAllModal, setAcceptAllModal] = useState(false);

  // AI / History suggestion state
  const [suggestionMeta, setSuggestionMeta] = useState({ commission: null, tax: null, net: null });
  const [mainSuggestions, setMainSuggestions] = useState({ commission: null, tax: null, net: null });
  const [suggestLoading, setSuggestLoading] = useState(false);
  
  const [paymentSuggestions, setPaymentSuggestions] = useState({});
  const [paymentSuggestLoading, setPaymentSuggestLoading] = useState(false);

  const loadInitialData = async () => {
    setLoadingOpts(true);
    try {
      const [accResult, deptResult] = await Promise.all([
        fetchAccountCodes(),
        fetchDepartments(),
      ]);

      const mappedAcc = accResult
        .filter(a => a.AccCode && a.AccCode !== 'AccCode')
        .map(a => ({ code: a.AccCode, name: a.Description, name2: a.Description2, nature: a.Nature, type: a.Type }));

      const mappedDept = deptResult
        .filter(d => d.DeptCode && d.DeptCode !== 'CodeDep')
        .map(d => ({ code: d.DeptCode, name: d.Description, name2: d.Description2 }));

      setMasterAccounts(mappedAcc);
      setMasterDepartments(mappedDept);
    } catch (err) {
      console.error("Failed to load carmen dictionary:", err);
    } finally {
      setLoadingOpts(false);
    }

    try {
      const prefixResult = await fetchGLPrefixes();
      const mappedPrefixes = prefixResult
        .filter(p => p.PrefixName)
        .map(p => ({ code: p.PrefixName, name: p.Description }));
      setMasterGLPrefixes(mappedPrefixes);
    } catch (err) {
      console.warn("GL prefix load failed (non-critical):", err);
    }
  };

  useEffect(() => {
    loadInitialData();

    let ocrBank = '';
    let ocrCompany = {};
    try {
      const ocrState = JSON.parse(localStorage.getItem('ocr_wizard_state') || '{}');
      ocrBank = OCR_BANK_MAP[ocrState.bank] || '';

      if (ocrState.details && Array.isArray(ocrState.details)) {
        const types = new Set();
        let comm = false, tx = false, n = false;
        const toNum = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;

        ocrState.details.forEach(d => {
          if (d.Transaction) types.add(d.Transaction);
          if (toNum(d.CommisAmt) > 0) comm = true;
          if (toNum(d.TaxAmt) > 0) tx = true;
          if (toNum(d.Total) > 0) n = true;
        });
        setActiveScan({ paymentTypes: types, commission: comm, tax: tx, net: n });
      }

      const ocrConfig = JSON.parse(localStorage.getItem('accountingConfig') || '{}');
      ocrCompany = ocrConfig.company || {};
    } catch (e) { }

    const detectBankFromCompanyName = (name) => {
      if (!name) return '';
      if (name.includes('กรุงเทพ')) return 'Bangkok Bank (BBL)';
      if (name.includes('กสิกร')) return 'Kasikornbank (KBANK)';
      if (name.includes('ไทยพาณิชย์')) return 'Siam Commercial Bank (SCB)';
      return '';
    };

    const config = localStorage.getItem('accountingConfig');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        const detectedBank = detectBankFromCompanyName(parsed.company?.name || ocrCompany?.name);
        const finalBank = parsed.bank || ocrBank || detectedBank;
        setBank(finalBank);
        setFilePrefix(parsed.filePrefix || '');
        setFileSource(parsed.fileSource || '');
        setDescription(parsed.description || '');

        let companyData = { name: '', taxId: '', branch: '', address: '' };
        if (parsed.company) {
          companyData = { ...companyData, ...parsed.company };
        } else if (Object.keys(ocrCompany).length) {
          companyData = { ...companyData, ...ocrCompany };
        }

        if (finalBank && BANK_INFO[finalBank]) {
          const info = BANK_INFO[finalBank];
          companyData.name = info.name;
          companyData.taxId = info.taxId;
          companyData.address = info.address;
        }
        setCompany(companyData);

        if (parsed.mappings) {
          setMappings(prev => ({ ...prev, ...parsed.mappings }));
        }
      } catch (e) { }
    } else if (ocrBank) {
      setBank(ocrBank);
      let companyData = { name: '', taxId: '', branch: '', address: '' };
      if (Object.keys(ocrCompany).length) {
        companyData = { ...companyData, ...ocrCompany };
      }
      if (BANK_INFO[ocrBank]) {
        const info = BANK_INFO[ocrBank];
        companyData.name = info.name;
        companyData.taxId = info.taxId;
        companyData.address = info.address;
      }
      setCompany(companyData);
    }

    const amountState = localStorage.getItem('accountMappingAmount');
    if (amountState) {
      try {
        const parsedAmount = JSON.parse(amountState);
        const savedCustomTypes = parsedAmount.__customTypes || [];
        setCustomPaymentTypes(savedCustomTypes);
        setPaymentAmount(prev => {
          const newState = { ...prev };
          Object.keys(parsedAmount).forEach(k => {
            if (k !== '__customTypes') newState[k] = parsedAmount[k];
          });
          savedCustomTypes.forEach(type => {
            if (!newState[type]) newState[type] = { dept: '', acc: '' };
          });
          return newState;
        });
      } catch (e) { }
    }
  }, []);

  const autoSuggest = async () => {
    if (!masterAccounts.length) return;

    const fieldsToFetch = ['commission', 'tax', 'net'].filter(f =>
      (!mappings[f] || !mappings[f].dept || !mappings[f].acc) &&
      !(mainSuggestions[f] && mainSuggestions[f].source === 'history')
    );

    if (fieldsToFetch.length === 0) {
      setModalConfig({
        show: true,
        title: '✓ All Mappings Completed',
        message: 'All values have been successfully mapped. You can proceed to the next step.',
        type: 'success'
      });
      return;
    }

    setSuggestLoading(true);
    let fromAI = {};

    try {
      const aiResult = await suggestMapping({
        accounts: masterAccounts.map(a => ({ code: a.code, name: a.name, type: a.type })),
        departments: masterDepartments.map(d => ({ code: d.code, name: d.name })),
      });

      const suggestKeyMap = { commission: 'Credit card commission', tax: 'Input Tax', net: 'Bank Account' };
      fieldsToFetch.forEach(f => {
        const s = (aiResult.suggestions || {})[suggestKeyMap[f]] || {};
        if (s.dept || s.acc) {
          fromAI[f] = { dept: s.dept || '', acc: s.acc || '' };
        }
      });
      if (Object.keys(fromAI).length > 0) {
        setMainSuggestions(prev => {
          const next = { ...prev };
          Object.entries(fromAI).forEach(([k, v]) => {
            const existing = next[k] || {};
            next[k] = {
              dept: v.dept || existing.dept || '',
              acc: v.acc || existing.acc || '',
              source: 'ai'
            };
          });
          return next;
        });
        setSuggestionMeta(prev => {
          const next = { ...prev };
          Object.keys(fromAI).forEach(k => { next[k] = 'ai'; });
          return next;
        });
      }
    } catch (err) {
      console.error('[Mapping] AI suggest failed:', err);
    } finally {
      setSuggestLoading(false);
    }
  };

  const confirmMainSuggestion = (key) => {
    const suggestion = mainSuggestions[key];
    if (suggestion) {
      setMappings(prev => {
        const cur = prev[key] || { dept: '', acc: '' };
        return {
          ...prev,
          [key]: {
            dept: cur.dept || suggestion.dept || '',
            acc: cur.acc || suggestion.acc || '',
          }
        };
      });
    }
    setMainSuggestions(prev => ({ ...prev, [key]: null }));
    setSuggestionMeta(prev => ({ ...prev, [key]: null }));
  };

  const rejectMainSuggestion = (key) => {
    setMainSuggestions(prev => ({ ...prev, [key]: null }));
    setSuggestionMeta(prev => ({ ...prev, [key]: null }));
  };

  const confirmPaymentSuggestion = (type) => {
    const suggestion = paymentSuggestions[type];
    if (suggestion) {
      setPaymentAmount(prev => {
        const cur = prev[type] || { dept: '', acc: '' };
        return {
          ...prev,
          [type]: {
            dept: cur.dept || suggestion.dept || '',
            acc: cur.acc || suggestion.acc || '',
          }
        };
      });
    }
    setPaymentSuggestions(prev => ({ ...prev, [type]: null }));
  };

  const rejectPaymentSuggestion = (type) => {
    setPaymentSuggestions(prev => ({ ...prev, [type]: null }));
  };

  const handleAcceptAll = () => {
    setMappings(prev => {
      const next = { ...prev };
      ['commission', 'tax', 'net'].forEach(key => {
        const s = mainSuggestions[key];
        if (s) {
          const cur = next[key] || { dept: '', acc: '' };
          next[key] = {
            dept: cur.dept || s.dept || '',
            acc: cur.acc || s.acc || '',
          };
        }
      });
      return next;
    });
    setMainSuggestions({ commission: null, tax: null, net: null });
    setSuggestionMeta({ commission: null, tax: null, net: null });

    setPaymentAmount(prev => {
      const next = { ...prev };
      Object.entries(paymentSuggestions).forEach(([type, s]) => {
        if (s) {
          const cur = next[type] || { dept: '', acc: '' };
          next[type] = {
            dept: cur.dept || s.dept || '',
            acc: cur.acc || s.acc || '',
          };
        }
      });
      return next;
    });
    setPaymentSuggestions({});
    setAcceptAllModal(false);
  };

  const autoSuggestPaymentTypes = async (specificTypes = null) => {
    if (!masterAccounts.length) return;
    setPaymentSuggestLoading(true);

    const allTypes = specificTypes || [...activeScan.paymentTypes, ...customPaymentTypes];

    const needsAI = allTypes.filter(t =>
      (!paymentAmount[t] || !paymentAmount[t].dept || !paymentAmount[t].acc) &&
      !(paymentSuggestions[t] && paymentSuggestions[t].source === 'history')
    );

    if (needsAI.length === 0) {
      setPaymentSuggestLoading(false);
      setModalConfig({
        show: true,
        title: '✓ All Mappings Completed',
        message: 'All Payment Types have been successfully mapped.',
        type: 'success'
      });
      return;
    }

    const newSuggestions = {};

    try {
      const result = await suggestPaymentTypes({
        payment_types: needsAI,
        accounts: masterAccounts.map(a => ({ code: a.code, name: a.name, type: a.type })),
        departments: masterDepartments.map(d => ({ code: d.code, name: d.name })),
      });
      Object.entries(result.suggestions || {}).forEach(([t, val]) => {
        if (val.dept || val.acc) {
          newSuggestions[t] = { dept: val.dept || null, acc: val.acc || null, source: 'ai' };
        }
      });
    } catch (err) {
      console.error('AI payment type suggest failed:', err);
    }

    setPaymentSuggestions(prev => ({ ...prev, ...newSuggestions }));
    setPaymentSuggestLoading(false);
  };

  const handleBankChange = (selected) => {
    setBank(selected);
    if (BANK_INFO[selected]) {
      const info = BANK_INFO[selected];
      setCompany(prev => ({ ...prev, name: info.name, taxId: info.taxId, address: info.address }));
    }
  };

  const handleCompanyChange = (e, field) => {
    setCompany({ ...company, [field]: e.target.value });
  };

  const handleMappingChange = (type, field, value) => {
    setMappings(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
    }));
    setSuggestionMeta(prev => ({ ...prev, [type]: null }));
    setMainSuggestions(prev => ({ ...prev, [type]: null }));
  };

  const handlePaymentMappingChange = (type, field, value) => {
    setPaymentAmount(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
    setPaymentSuggestions(prev => ({ ...prev, [type]: null }));
  };

  const handleAddCustomType = () => {
    const trimmed = newCustomType.trim().toUpperCase();
    if (!trimmed || activeScan.paymentTypes.has(trimmed) || customPaymentTypes.includes(trimmed)) return;
    setCustomPaymentTypes(prev => [...prev, trimmed]);
    setPaymentAmount(prev => ({ ...prev, [trimmed]: { dept: '', acc: '' } }));
    setNewCustomType('');

    if (masterAccounts.length && masterDepartments.length) {
      autoSuggestPaymentTypes([trimmed]);
    }
  };

  const handleRemoveCustomType = (type) => {
    setCustomPaymentTypes(prev => prev.filter(t => t !== type));
    setPaymentAmount(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  const saveAmountSelection = () => {
    localStorage.setItem('accountMappingAmount', JSON.stringify({ ...paymentAmount, __customTypes: customPaymentTypes }));
    setIsAmountModalOpen(false);
  };

  const companyRequiredFields = [
    { key: 'name', label: 'Company Name' },
    { key: 'taxId', label: 'Tax ID' },
    { key: 'branch', label: 'Branch No' },
    { key: 'address', label: 'Address' },
  ];
  const missingCompanyFields = companyRequiredFields.filter(f => !company[f.key]?.trim());

  const topLevelRequired = [
    { key: 'bank', label: 'Bank', value: bank },
    { key: 'filePrefix', label: 'File Prefix', value: filePrefix },
    { key: 'fileSource', label: 'File Source', value: fileSource },
  ];
  const missingTopFields = topLevelRequired.filter(f => !f.value?.trim());

  const saveAllSettings = async (shouldClose = false) => {
    if (saving) return;
    const allMissing = [...missingTopFields, ...missingCompanyFields];
    if (allMissing.length > 0) {
      setModalConfig({
        show: true,
        title: 'Please fill in all required fields',
        message: `Please fill in ${allMissing.map(f => f.label).join(', ')} before saving`,
        type: 'error'
      });
      return;
    }

    setSaving(true);
    try {
      const config = { bank, filePrefix, fileSource, description, company, mappings, paymentAmount };
      localStorage.setItem('accountingConfig', JSON.stringify(config));

      if (bank) {
        const allMappings = { ...mappings };
        Object.entries(paymentAmount).forEach(([type, val]) => {
          if (val.dept || val.acc) allMappings[type] = val;
        });
        try {
          await saveMappingHistory({ bank_name: bank, mappings: allMappings });
        } catch (_) { }
      }

      if (shouldClose && window.opener) {
        window.close();
      } else {
        window.location.hash = '/CreditCardOCR';
        if (!shouldClose) {
          setModalConfig({
            show: true,
            title: 'Save Successful',
            message: 'Account Mapping settings have been saved successfully.',
            type: 'success'
          });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return {
    masterAccounts, masterDepartments, masterGLPrefixes, loadingOpts,
    bank, setBank, handleBankChange,
    filePrefix, setFilePrefix,
    fileSource, setFileSource,
    description, setDescription,
    company, setCompany, handleCompanyChange,
    mappings, setMappings, handleMappingChange,
    paymentAmount, handlePaymentMappingChange,
    customPaymentTypes, newCustomType, setNewCustomType, handleAddCustomType, handleRemoveCustomType,
    isAmountModalOpen, setIsAmountModalOpen, saveAmountSelection,
    activeScan,
    modalConfig, setModalConfig,
    saving, saveAllSettings,
    acceptAllModal, setAcceptAllModal, handleAcceptAll,
    suggestionMeta, mainSuggestions, suggestLoading, autoSuggest, confirmMainSuggestion, rejectMainSuggestion,
    paymentSuggestions, setPaymentSuggestions, paymentSuggestLoading, autoSuggestPaymentTypes, confirmPaymentSuggestion, rejectPaymentSuggestion,
    loadInitialData,
    companyRequiredFields, missingCompanyFields, missingTopFields,
    allPaymentTypes: [...activeScan.paymentTypes, ...customPaymentTypes.filter(t => !activeScan.paymentTypes.has(t))],
  };
}
