/**
 * Narration for the "How to buy a package" tour, shown from #/pricing.
 *
 * Content, not chrome — so it lives here beside `releaseNotes.ts` and is read as
 * `step[lang]`, instead of adding forty paragraphs to `i18n/dict/` (which
 * keeps the tour's buttons and labels). This is the file a second module copies
 * to start its own tutorial.
 *
 * **Thai is the reviewed, authoritative copy** — supplied and signed off for
 * this feature. English follows it sentence for sentence but nobody has
 * proofread it; treat it as a first pass.
 *
 * **Quote a button by the name the reader sees.** The figure renders in the
 * reader's language, so the Thai copy names the Thai label ("ยืนยันการชำระเงิน",
 * not "Confirm payment") — the string `i18n/dict/` gives that key under `th`.
 * Untranslated by design: Carmen, the plan tiers (Starter / Growth /
 * Professional) and "Proforma Invoice", which is printed in English on the
 * document itself.
 *
 * The tour has more steps than that copy was written against: each screen opens
 * with an overview before its details. The approved sentences are kept intact on
 * the step they describe, and the added steps are written in the same voice.
 *
 * Attaching the slip is taught **once**, on the last step: the buyer prints the
 * proforma, pays days later through their own finance process and comes back, so
 * the pending-order banner is the path they actually use — not the slip card the
 * checkout still renders under the invoice.
 *
 * **No price is typed in this file.** The plan and top-up lines, and the annual
 * discount, are written from the live catalog by `purchaseTutorial()`, so a reprice
 * is a database row and the tour follows it. (It used to list them by hand, and had
 * already dropped Lite and Micro by the time that was noticed.)
 */

import {
  CalendarCheck,
  Coins,
  CloudUpload,
  FileText,
  LayoutDashboard,
  MousePointerClick,
  Printer,
  Scale,
} from 'lucide-react'
import type { TutorialStepDefinition } from '@/shared/components/tutorial'
import { PLAN_META, annualSavePct, perDoc } from '@/features/billing/constants'
import { formatThb } from '@/shared/lib/money'
import type { CreditPack } from '@/shared/api/credits'

/**
 * A step, plus which of `PURCHASE_FIGURES` illustrates it (1-based).
 *
 * Steps with no `spot` are overviews: the whole screen, nothing highlighted.
 * Each screen opens with one, then the steps that follow zoom into its parts —
 * so the reader always knows where they are before being shown a detail.
 */
export type PurchaseStep = TutorialStepDefinition & { screen: number }

const STEPS: PurchaseStep[] = [
  {
    screen: 1,
    icon: LayoutDashboard,
    en: {
      title: 'Where you start',
      heading: 'Start buying a package',
      body: [
        'Everything starts from the screen you already work on. The remaining document quota and the button that adds more sit together in the menu bar at the top right.',
      ],
    },
    th: {
      title: 'จุดเริ่มต้น',
      heading: 'เริ่มต้นการเลือกซื้อแพ็กเกจ',
      body: [
        'ทุกอย่างเริ่มจากหน้าจอที่ท่านใช้งานอยู่เป็นประจำ โดยยอดโควตาคงเหลือและปุ่มสำหรับเพิ่มโควตาจะอยู่ด้วยกันที่แถบเมนูด้านบนขวา',
      ],
    },
  },
  {
    screen: 1,
    spot: 'buy-btn',
    icon: MousePointerClick,
    en: {
      title: 'Click Buy',
      heading: 'Click Buy to open Plans & Credits',
      body: [
        'To manage your document processing quota, click **Buy >** in the menu bar at the top right of the Carmen screen to open the **Plans & Credits** page.',
      ],
    },
    th: {
      title: 'คลิกปุ่ม ซื้อ',
      heading: 'คลิกปุ่ม ซื้อ เพื่อเข้าสู่หน้าแพ็กเกจและเครดิต',
      body: [
        'เมื่อต้องการบริหารจัดการโควตาการประมวลผลเอกสาร ให้คลิกปุ่ม **ซื้อ >** ที่แถบเมนูด้านบนขวาของหน้าจอ Carmen เพื่อเข้าสู่หน้า **แพ็กเกจและเครดิต**',
      ],
    },
  },
  {
    screen: 2,
    icon: Scale,
    en: {
      title: 'Which one suits you?',
      heading: 'Which one suits you?',
      body: [
        '• **Monthly Plans:** for a hotel with a steady flow of documents, where a clear monthly cost is worth planning around.',
        '• **Top-Up Credits:** for an unpredictable volume, or to hold credits in reserve.',
      ],
    },
    th: {
      title: 'เลือกแบบไหนดี?',
      heading: 'เลือกแบบไหนดี?',
      body: [
        '• **แพ็กเกจรายเดือน:** เหมาะกับโรงแรมที่มีเอกสารเข้าประจำ ต้องการวางแผนค่าใช้จ่ายรายเดือนได้ชัดเจน',
        '• **เติมเครดิต:** เหมาะกับปริมาณเอกสารที่ไม่แน่นอน หรือต้องการซื้อเครดิตสำรองไว้ใช้งาน',
      ],
    },
  },
  {
    screen: 2,
    spot: 'monthly-plans',
    icon: CalendarCheck,
    en: {
      title: 'Monthly Plans',
      heading: 'Choose a Monthly Plan',
      body: ['The system bills and resets the quota every month (nothing carries over).'],
    },
    th: {
      title: 'แพ็กเกจรายเดือน',
      heading: 'เลือกแพ็กเกจรายเดือน',
      body: ['ระบบจะตัดยอดและรีเซ็ตโควตาใหม่ทุกเดือน (ไม่มีการทบยอดคงเหลือ)'],
    },
  },
  {
    screen: 2,
    spot: 'topup-credits',
    icon: Coins,
    en: {
      title: 'Top-Up Credits',
      heading: 'Choose Top-Up Credits',
      body: ['A one-time purchase of quota that never expires (1 credit covers 1 document page).'],
    },
    th: {
      title: 'เติมเครดิต',
      heading: 'เลือกแพ็กเกจเติมเครดิต',
      body: ['ซื้อโควตาแบบครั้งเดียว ไม่มีวันหมดอายุ (โดย 1 เครดิต เท่ากับเอกสาร 1 หน้า)'],
    },
  },
  {
    screen: 3,
    spot: 'billing-dual-section',
    icon: FileText,
    en: {
      title: 'Billing information',
      heading: 'Fill in the billing details and continue',
      body: [
        'Check and complete the **Billing information** section, which is what the tax documents are issued against (Company / buyer name, Tax ID, Branch, Address, Purchaser name, Tel., Email).',
        'Check that the **Subtotal (excl. VAT)** in the **Order summary** on the right is correct.',
        'Click **Continue to payment** to issue the Proforma Invoice.',
      ],
    },
    th: {
      title: 'ข้อมูลออกใบแจ้งหนี้',
      heading: 'กรอกข้อมูลการออกใบแจ้งหนี้และดำเนินการต่อ',
      body: [
        'ตรวจสอบและกรอกข้อมูลในส่วน **ข้อมูลสำหรับการเรียกเก็บเงิน** สำหรับการออกเอกสารทางภาษี (ชื่อบริษัท / ผู้ซื้อ, เลขประจำตัวผู้เสียภาษี, สาขา, ที่อยู่, ชื่อผู้สั่งซื้อ, โทร., อีเมล)',
        'ตรวจสอบความถูกต้องของ **ยอดก่อนภาษี (ไม่รวม VAT)** ในส่วน **สรุปคำสั่งซื้อ** ทางขวามือ',
        'คลิกปุ่ม **ดำเนินการชำระเงิน** เพื่อสร้างใบแจ้งหนี้ Proforma Invoice',
      ],
    },
  },
  {
    screen: 4,
    icon: FileText,
    en: {
      title: 'Proforma Invoice',
      heading: 'Check the Proforma Invoice',
      body: [
        'The system issues a **Proforma Invoice** showing the net amount to pay, with 7% VAT included and 3% withholding tax already deducted, along with the Bangkok Bank account number **195-4-97445-5** to transfer to.',
      ],
    },
    th: {
      title: 'Proforma Invoice',
      heading: 'ตรวจสอบใบแจ้งหนี้ Proforma Invoice',
      body: [
        'ระบบจะสร้าง **Proforma Invoice** โดยแสดงยอดชำระสุทธิที่รวมภาษีมูลค่าเพิ่ม 7% และหักภาษี ณ ที่จ่าย 3% เรียบร้อยแล้ว พร้อมระบุข้อมูลบัญชีธนาคารกรุงเทพ เลขที่บัญชี **195-4-97445-5** สำหรับการโอนชำระเงิน',
      ],
    },
  },
  {
    screen: 4,
    // A selector, not a <Spot>: the print toolbar belongs to ProformaDocument,
    // and the figure mounts that component rather than redrawing it.
    spot: '.pf-toolbar',
    icon: Printer,
    en: {
      title: 'Save the document',
      heading: 'Save the document for your payment process',
      body: [
        "Click **Print / Save PDF** at the top right to save the document and take it through your hotel's payment procedure.",
      ],
    },
    th: {
      title: 'บันทึก / พิมพ์เอกสาร',
      heading: 'บันทึกเอกสารเพื่อนำไปดำเนินการเบิกจ่าย',
      body: [
        'คลิก **พิมพ์ / บันทึก PDF** ที่มุมขวาบน เพื่อบันทึกเอกสารและนำไปดำเนินการเบิกจ่ายตามระเบียบของโรงแรม',
      ],
    },
  },
  {
    screen: 5,
    spot: 'pending-order',
    icon: CloudUpload,
    en: {
      title: 'Attach the slip and confirm',
      heading: 'Attach proof of payment, then confirm',
      body: [
        'Once the transfer is made, return to the **Plans & Credits** page in Carmen. The system shows a **"You have an unfinished order"** notice — drag the file or click to attach your proof of payment in the **Upload payment slip** box.',
        'Check the attached file, then click **Confirm payment**. The details go to the Carmen team, who will add the credits to your account.',
        "**Ready to buy for real?** Press **'Buy a package'** below to close this guide and choose your plan.",
      ],
    },
    th: {
      title: 'แนบสลิปและยืนยัน',
      heading: 'แนบหลักฐานการชำระเงินและยืนยัน',
      body: [
        'เมื่อดำเนินการชำระเงินแล้ว ให้กลับมาที่หน้า **แพ็กเกจและเครดิต** ในระบบ Carmen ระบบจะแสดงข้อความแจ้งเตือน **"คุณมีคำสั่งซื้อที่ยังไม่เสร็จ"** ให้ลากไฟล์หรือคลิกเพื่อแนบหลักฐานการโอนเงินที่ช่อง **อัปโหลดสลิปการชำระเงิน**',
        'ตรวจสอบความถูกต้องของไฟล์ที่แนบ จากนั้นคลิกปุ่ม **ยืนยันการชำระเงิน** ระบบจะส่งข้อมูลไปยังทีมงาน Carmen และจะดำเนินการเพิ่มเครดิตลงในบัญชีของท่าน',
        "**พร้อมสั่งซื้อจริงแล้วใช่ไหม?** กดปุ่ม **'ซื้อ Package'** ด้านล่าง เพื่อปิดคู่มือและเลือกแพ็กเกจได้ทันที",
      ],
    },
  },
]

/** The catalog the page behind the tour has already loaded. */
export interface TourCatalog {
  plans: CreditPack[]
  packs: CreditPack[]
}

/**
 * The price lines a step appends to its approved copy, per language — same wording
 * the reviewed copy used, one line per catalog row. Null for steps that quote no price.
 */
function priceLines(spot: string | undefined, { plans, packs }: TourCatalog) {
  if (spot === 'monthly-plans') {
    const pct = annualSavePct(plans)
    const name = (p: CreditPack) => PLAN_META[p.code]?.name ?? p.code
    const docs = (p: CreditPack) => p.credits.toLocaleString('en-US')
    const price = (p: CreditPack) => formatThb(p.price_thb)
    return {
      en: [
        ...(pct ? [`• **Discount:** paying a year in advance takes **${pct}%** off.`] : []),
        ...plans.map(p => `• **${name(p)}:** ${docs(p)} documents / month (฿${price(p)} / month)`),
      ],
      th: [
        ...(pct ? [`• **ส่วนลด:** การเลือกชำระล่วงหน้าแบบรายปี จะได้รับส่วนลด **${pct}%**`] : []),
        ...plans.map(p => `• **${name(p)}:** ${docs(p)} เอกสาร / เดือน (฿${price(p)} / เดือน)`),
      ],
    }
  }
  if (spot === 'topup-credits') {
    const credits = (p: CreditPack) => p.credits.toLocaleString('en-US')
    const price = (p: CreditPack) => formatThb(p.price_thb)
    const rate = (p: CreditPack) => formatThb(perDoc(p.price_thb, p.credits), true)
    return {
      en: packs.map(
        p => `• **${credits(p)} Credits:** ฿${price(p)} (฿${rate(p)} per page on average)`
      ),
      th: packs.map(p => `• **${credits(p)} เครดิต:** ฿${price(p)} (เฉลี่ย ฿${rate(p)}/หน้า)`),
    }
  }
  return null
}

/** The tour's steps, with every price written from `catalog`. */
export function purchaseTutorial(catalog: TourCatalog): PurchaseStep[] {
  return STEPS.map(step => {
    const lines = priceLines(step.spot, catalog)
    if (!lines) return step
    return {
      ...step,
      en: { ...step.en, body: [...step.en.body, ...lines.en] },
      th: { ...step.th, body: [...step.th.body, ...lines.th] },
    }
  })
}
