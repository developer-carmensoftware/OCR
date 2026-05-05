import React from 'react';
import { Network, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import CustomModal from '../components/common/CustomModal';
import '../styles/pages/mapping.css';
import { useMapping } from '../hooks/useMapping';
import TopLevelConfigSection from '../components/credit-card/TopLevelConfigSection';
import CompanyInfoSection from '../components/credit-card/CompanyInfoSection';
import AccountMappingTable from '../components/credit-card/AccountMappingTable';
import PaymentTypeModal from '../components/credit-card/PaymentTypeModal';

export default function Mapping() {
  const mappingCtrl = useMapping();

  return (
    <>
      <CustomModal
        show={mappingCtrl.modalConfig.show}
        title={mappingCtrl.modalConfig.title}
        message={mappingCtrl.modalConfig.message}
        type={mappingCtrl.modalConfig.type}
        onConfirm={() => mappingCtrl.setModalConfig({ ...mappingCtrl.modalConfig, show: false })}
      />
      <CustomModal
        show={mappingCtrl.acceptAllModal}
        title="ยืนยัน Accept All"
        message="AI อาจแนะนำรหัสบัญชีผิดพลาดได้ คุณได้ตรวจสอบรายการทั้งหมดแล้วใช่ไหม?"
        type="warning"
        confirmText="ยืนยัน ยอมรับทั้งหมด"
        cancelText="ยกเลิก"
        onConfirm={mappingCtrl.handleAcceptAll}
        onCancel={() => mappingCtrl.setAcceptAllModal(false)}
      />

      <div className="container" style={{ margin: '2rem auto', maxWidth: '800px' }}>
        <h1><Network size={20} /> Account Mapping Configuration</h1>

        <div style={{ marginBottom: '1.5rem' }}>
          <button onClick={() => window.location.hash = '/CreditCardOCR'} className="btn-cancel" style={{ textDecoration: 'none', padding: '0.6rem 1.2rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px', background: 'var(--gray-50)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            <ArrowLeft size={14} /> กลับสู่หน้าหลัก
          </button>
        </div>

        <TopLevelConfigSection {...mappingCtrl} />
        
        <CompanyInfoSection {...mappingCtrl} />

        <AccountMappingTable
          {...mappingCtrl}
          requiredMissingCount={mappingCtrl.activeScan.paymentTypes.size > 0 ? [...mappingCtrl.activeScan.paymentTypes].filter(t => !mappingCtrl.paymentAmount[t]?.dept || !mappingCtrl.paymentAmount[t]?.acc).length : 0}
          amountMappedCount={mappingCtrl.allPaymentTypes.filter(t => mappingCtrl.paymentAmount[t]?.dept && mappingCtrl.paymentAmount[t]?.acc).length}
        />

        <div style={{ marginTop: '2.5rem' }}>
          <button
            className="btn-save"
            onClick={() => mappingCtrl.saveAllSettings(true)}
            disabled={mappingCtrl.saving}
            style={{
              width: '100%',
              padding: '1.2rem',
              background: mappingCtrl.saving ? '#5eaca3' : 'var(--teal)',
              color: '#fff',
              borderRadius: '12px',
              cursor: mappingCtrl.saving ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              border: 'none',
              boxShadow: '0 4px 15px rgba(13,148,136,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem'
            }}
          >
            {mappingCtrl.saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            {mappingCtrl.saving ? 'กำลังบันทึก...' : 'บันทึกและปิดหน้าต่าง'}
          </button>
        </div>

      </div>

      <PaymentTypeModal
        {...mappingCtrl}
        amountMappedCount={mappingCtrl.allPaymentTypes.filter(t => mappingCtrl.paymentAmount[t]?.dept && mappingCtrl.paymentAmount[t]?.acc).length}
      />
    </>
  );
}
