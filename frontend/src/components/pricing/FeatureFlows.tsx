import { useEffect, useRef, useState, useCallback } from 'react'
import {
  CreditCard,
  ReceiptText,
  Lightbulb,
  FileText,
  Settings2,
  FileCheck2,
  Receipt,
  ScanLine,
  ShieldCheck,
  Database,
  Tag,
  Sparkles,
  Hash,
  ArrowRight,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'

/* ── Shared helpers ── */

function useInViewSequence(timeline: readonly number[], active: boolean) {
  const ref = useRef<HTMLElement>(null)
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (!active) {
      setPhase(0)
      return
    }
    const el = ref.current
    if (!el) return
    const final = timeline.length + 1
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setPhase(final)
      return
    }
    const timers: number[] = []
    setPhase(1)
    timeline.forEach((t, i) => timers.push(window.setTimeout(() => setPhase(i + 2), t)))
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [timeline, active])
  return { ref, phase }
}

function Head({ Icon, title, sub }: { Icon: LucideIcon; title: string; sub: string }) {
  return (
    <header className="flow-head">
      <span className="flow-head-icon" aria-hidden="true">
        <Icon size={24} strokeWidth={1.9} />
      </span>
      <div className="flow-head-text">
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
    </header>
  )
}

function Node({
  Icon,
  label,
  caption,
  on,
  spin,
}: {
  Icon: LucideIcon
  label: string
  caption: string
  on: boolean
  spin?: boolean
}) {
  return (
    <div className={`flow-node${on ? ' is-on' : ''}`}>
      <span className={`flow-node-icon${spin ? ' flow-node-icon--spin' : ''}`} aria-hidden="true">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="flow-node-label">{label}</span>
      <span className="flow-node-caption">{caption}</span>
    </div>
  )
}

function HArrow({ on }: { on: boolean }) {
  return (
    <span className={`flow-arrow${on ? ' is-on' : ''}`} aria-hidden="true">
      <ArrowRight size={20} />
    </span>
  )
}

/* ── Feature definitions ── */

const FEATURES = [
  {
    key: 'cc',
    Icon: CreditCard,
    title: 'Credit Card Commission Automation',
    accent: 'accent-blue',
    desc: 'ระบบช่วยเปลี่ยนเอกสาร 1 ใบ ให้เป็นเรื่องง่าย โดยสร้าง Journal Voucher เพื่อบันทึกบัญชีอัตโนมัติ และทำ Input Tax Reconciliation บันทึกภาษีซื้อเพื่อออกรายงานนำส่งสรรพากร ลดขั้นตอนการทำงานแบบเดิม ๆ ได้อย่างแม่นยำ',
  },
  {
    key: 'ap',
    Icon: ReceiptText,
    title: 'AP Invoice Automation',
    accent: 'accent-emerald',
    desc: 'บอกลาการคีย์ข้อมูลด้วยตนเอง สำหรับรายการสั่งซื้อที่ไม่มี PR/PO หรือรายการค่าบริการต่าง ๆ เพียงแค่สแกนเอกสารเข้าสู่ระบบ ระบบจะจัดการสร้างเอกสารให้อัตโนมัติ ช่วยประหยัดเวลาการทำงานลงได้มากถึง 60%',
  },
  {
    key: 'gl',
    Icon: Lightbulb,
    title: 'Account Code Suggestion',
    accent: 'accent-teal',
    desc: 'เพิ่มความรวดเร็วในการทำงานด้วยระบบแนะนำการลงบัญชีอัตโนมัติ โดย AI จะช่วยตรวจสอบและวิเคราะห์ข้อมูลการบันทึกบัญชีในอดีต เพื่อให้คำแนะนำที่ถูกต้อง และระบบจะเรียนรู้เพื่อเพิ่มความแม่นยำขึ้นเรื่อย ๆ อย่างต่อเนื่อง',
  },
] as const

/* ── Flow detail panels ── */

const CC_TIMELINE = [850, 2050] as const

function CreditCardDetail({ active }: { active: boolean }) {
  const { ref, phase } = useInViewSequence(CC_TIMELINE, active)
  return (
    <article ref={ref} className="flow-card accent-blue">
      <Head
        Icon={CreditCard}
        title="Credit Card Commission Automation"
        sub="จากเอกสารใบเดียว ระบบสร้างบันทึกบัญชีและรายงานภาษีซื้อให้ครบ"
      />
      <div className="flow-body flow-row">
        <Node
          Icon={FileText}
          label="รับเอกสาร"
          caption="ใบแจ้งค่าธรรมเนียมจากธนาคาร"
          on={phase >= 1}
        />
        <HArrow on={phase >= 2} />
        <div className={`flow-node flow-node--wide${phase >= 2 ? ' is-on' : ''}`}>
          <span
            className={`flow-node-icon${phase >= 2 ? ' flow-node-icon--spin' : ''}`}
            aria-hidden="true"
          >
            <Settings2 size={22} strokeWidth={1.8} />
          </span>
          <span className="flow-node-label">ระบบจับคู่บัญชีและภาษี</span>
          <ul className="flow-checklist">
            <li>อ่านและดึงข้อมูล</li>
            <li>จับคู่ผังบัญชี / ภาษี</li>
            <li>สร้างเอกสารปลายทาง</li>
          </ul>
        </div>
        <span className={`flow-branch${phase >= 3 ? ' is-on' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 100 100" fill="none" preserveAspectRatio="none">
            <path
              d="M 0 50 C 35 50, 45 18, 100 18"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 0 50 C 35 50, 45 82, 100 82"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </span>
        <div className="flow-out-col">
          <div className={`flow-out${phase >= 3 ? ' is-on' : ''}`}>
            <span className="flow-out-tag" aria-hidden="true">
              <FileCheck2 size={18} />
            </span>
            <div>
              <h4>บันทึกบัญชี (JV)</h4>
              <p>ลงบัญชีอัตโนมัติ ไม่ต้องคีย์มือ</p>
            </div>
          </div>
          <div className={`flow-out${phase >= 3 ? ' is-on' : ''}`}>
            <span className="flow-out-tag" aria-hidden="true">
              <Receipt size={18} />
            </span>
            <div>
              <h4>รายงานภาษีซื้อ</h4>
              <p>พร้อมนำส่งสรรพากร</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flow-result">
        <span className="flow-result-mark" aria-hidden="true">
          ✓
        </span>
        <p>จากเอกสาร 1 ใบ ได้งาน 2 อย่างอัตโนมัติ ลดงานซ้ำซ้อนและข้อผิดพลาด</p>
      </div>
    </article>
  )
}

const AP_TIMELINE = [800, 1750, 2700, 3650, 4600] as const

function ApInvoiceDetail({ active }: { active: boolean }) {
  const { ref, phase } = useInViewSequence(AP_TIMELINE, active)
  return (
    <article ref={ref} className="flow-card accent-emerald">
      <Head
        Icon={ReceiptText}
        title="AP Invoice Automation"
        sub="สแกนบิล ระบบอ่านและสร้างใบแจ้งหนี้ในระบบให้ ลดงานคีย์มือ 60%"
      />
      <div className="flow-body flow-stepper">
        <div className={`flow-stage${phase >= 1 ? ' is-on' : ''}`}>
          <span className="flow-stage-no">1</span>
          <Node
            Icon={ScanLine}
            label="สแกนบิล"
            caption="ใบแจ้งหนี้ หรือใบกำกับภาษี"
            on={phase >= 1}
          />
        </div>
        <span className={`flow-down${phase >= 2 ? ' is-on' : ''}`} aria-hidden="true">
          <ArrowRight size={18} />
        </span>
        <div className={`flow-stage${phase >= 2 ? ' is-on' : ''}`}>
          <span className="flow-stage-no">2</span>
          <div className="flow-substages">
            <Node
              Icon={FileText}
              label="ดึงข้อมูล"
              caption="เลขที่ ยอดเงิน ภาษี ผู้ขาย"
              on={phase >= 2}
            />
            <HArrow on={phase >= 3} />
            <Node
              Icon={ShieldCheck}
              label="ตรวจความถูกต้อง"
              caption="รูปแบบ + เทียบฐานผู้ขาย"
              on={phase >= 3}
            />
            <HArrow on={phase >= 4} />
            <Node
              Icon={Database}
              label="สร้างใบแจ้งหนี้"
              caption="บันทึกเข้าระบบ + รหัสบัญชี"
              on={phase >= 4}
            />
          </div>
        </div>
        <span className={`flow-down${phase >= 5 ? ' is-on' : ''}`} aria-hidden="true">
          <ArrowRight size={18} />
        </span>
        <div className={`flow-stage${phase >= 5 ? ' is-on' : ''}`}>
          <span className="flow-stage-no">3</span>
          <div className="flow-out-list">
            <h4>พร้อมใช้งานต่อในระบบ</h4>
            <ul>
              <li>บันทึก AP Invoice สำเร็จ</li>
              <li>พร้อมบันทึกบัญชี (JV) และทำจ่าย</li>
              <li>รายงานเจ้าหนี้ / ภาษีซื้อ</li>
            </ul>
          </div>
        </div>
      </div>
      <div className={`flow-benefits${phase >= 6 ? ' is-on' : ''}`}>
        <div className="flow-benefit">
          <b>60%</b>
          <span>ลดเวลาคีย์มือ</span>
        </div>
        <div className="flow-benefit">
          <span>ลดข้อผิดพลาด</span>
          <small>จากการบันทึกด้วยมือ</small>
        </div>
        <div className="flow-benefit">
          <span>ข้อมูลครบถ้วน</span>
          <small>ตรวจสอบย้อนได้</small>
        </div>
      </div>
    </article>
  )
}

const GL_TIMELINE = [850, 2050] as const

const GL_SAMPLES = [
  {
    key: 'water',
    label: 'ค่าน้ำประปาอาคารหลัก MWA',
    code: '5301-01 · ค่าน้ำประปาและสาธารณูปโภค',
    confidence: '98%',
  },
  {
    key: 'laundry',
    label: 'ค่าซักรีดผ้าห่มและเครื่องนอน',
    code: '5405-02 · ค่าจ้างซักรีดและทำความสะอาด',
    confidence: '95%',
  },
  {
    key: 'salmon',
    label: 'จัดซื้อปลาแซลมอนสดแช่แข็ง',
    code: '1401-03 · สินค้าคลังเครื่องดื่มและอาหาร',
    confidence: '92%',
  },
] as const

function GlSuggestionDetail({ active }: { active: boolean }) {
  const { ref, phase } = useInViewSequence(GL_TIMELINE, active)
  const [selected, setSelected] = useState(0)
  const sample = GL_SAMPLES[selected]
  const done = phase >= 3
  return (
    <article ref={ref} className="flow-card accent-teal">
      <Head
        Icon={Lightbulb}
        title="Account Code Suggestion"
        sub="ระบบดูจากประวัติการลงบัญชี แล้วแนะนำรหัสที่น่าจะใช่ให้เลือก"
      />
      <div className="flow-body flow-row">
        <div className={`flow-node flow-node--wide${phase >= 1 ? ' is-on' : ''}`}>
          <span className="flow-node-label">เลือกตัวอย่างรายการ</span>
          <div className="gl-pills">
            {GL_SAMPLES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className={`gl-pill${selected === i ? ' is-selected' : ''}`}
                onClick={() => setSelected(i)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <HArrow on={phase >= 2} />
        <Node
          Icon={Sparkles}
          label="เทียบประวัติ"
          caption={phase >= 2 ? 'พบรายการคล้ายกัน (95%+)' : 'ดูการลงบัญชีย้อนหลัง'}
          on={phase >= 2}
        />
        <HArrow on={done} />
        <div className={`flow-node flow-node--wide gl-output${done ? ' is-on' : ''}`}>
          <span className="flow-node-icon" aria-hidden="true">
            <Hash size={22} strokeWidth={1.8} />
          </span>
          <span className="flow-node-label">รหัสที่แนะนำ</span>
          <span className="gl-code">{done ? sample.code : 'กำลังวิเคราะห์…'}</span>
          <span className="gl-confidence">
            <Tag size={12} /> ความแม่นยำ {done ? sample.confidence : '--%'}
          </span>
        </div>
      </div>
    </article>
  )
}

const FLOW_PANELS = [CreditCardDetail, ApInvoiceDetail, GlSuggestionDetail] as const

/* ── Main export: tab selector + expandable detail ── */

export default function FeatureFlows() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const toggle = useCallback((i: number) => {
    setActiveIdx(prev => (prev === i ? null : i))
  }, [])

  return (
    <div className="flow-showcase">
      <div className="flow-tabs" role="tablist">
        {FEATURES.map((f, i) => {
          const isActive = activeIdx === i
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={isActive}
              className={`flow-tab ${f.accent}${isActive ? ' is-active' : ''}`}
              onClick={() => toggle(i)}
            >
              <span className="flow-tab-icon" aria-hidden="true">
                <f.Icon size={20} strokeWidth={1.9} />
              </span>
              <span className="flow-tab-title">{f.title}</span>
              <span className="flow-tab-desc">{f.desc}</span>
              <ChevronDown size={16} className={`flow-tab-chevron${isActive ? ' is-open' : ''}`} />
            </button>
          )
        })}
      </div>

      {FLOW_PANELS.map((Panel, i) => {
        const open = activeIdx === i
        return (
          <div key={i} className={`flow-detail${open ? ' is-open' : ''}`}>
            <div className="flow-detail-inner">
              <Panel active={open} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
