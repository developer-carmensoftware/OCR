/**
 * Narration for the "How to buy a package" tour, shown from #/pricing.
 *
 * Content, not chrome — so it lives here beside `releaseNotes.ts` and is read as
 * `step[lang]`, instead of adding forty paragraphs to `i18n/dict.ts` (which
 * keeps the tour's buttons and labels). This is the file a second module copies
 * to start its own tutorial.
 *
 * **Thai is the reviewed, authoritative copy** — supplied and signed off for
 * this feature. English follows it sentence for sentence but nobody has
 * proofread it; treat it as a first pass.
 *
 * The tour has more steps than that copy was written against: each screen opens
 * with an overview before its details, and the slip is attached on the payment
 * screen rather than after a detour to Plans. The approved sentences are kept
 * intact on the step they describe, and the added steps are written in the same
 * voice.
 */

import {
  CalendarCheck,
  CircleCheck,
  Coins,
  CloudUpload,
  FileText,
  LayoutDashboard,
  MousePointerClick,
  Printer,
  Scale,
} from 'lucide-react'
import type { TutorialStepDefinition } from '../../components/tutorial'

/**
 * A step, plus which of `PURCHASE_FIGURES` illustrates it (1-based).
 *
 * Steps with no `spot` are overviews: the whole screen, nothing highlighted.
 * Each screen opens with one, then the steps that follow zoom into its parts —
 * so the reader always knows where they are before being shown a detail.
 */
export type PurchaseStep = TutorialStepDefinition & { screen: number }

export const PURCHASE_TUTORIAL: PurchaseStep[] = [
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
      title: 'คลิกปุ่ม Buy',
      heading: 'คลิกปุ่ม Buy เพื่อเข้าสู่หน้า Plans & Credits',
      body: [
        'เมื่อต้องการบริหารจัดการโควตาการประมวลผลเอกสาร ให้คลิกปุ่ม **Buy >** ที่แถบเมนูด้านบนขวาของหน้าจอ Carmen เพื่อเข้าสู่หน้า **Plans & Credits**',
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
        '• **Monthly Plans:** เหมาะกับโรงแรมที่มีเอกสารเข้าประจำ ต้องการวางแผนค่าใช้จ่ายรายเดือนได้ชัดเจน',
        '• **Top-Up Credits:** เหมาะกับปริมาณเอกสารที่ไม่แน่นอน หรือต้องการซื้อเครดิตสำรองไว้ใช้งาน',
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
      body: [
        'The system bills and resets the quota every month (nothing carries over).',
        '• **Discount:** paying a year in advance takes **10%** off.',
        '• **Starter:** 200 documents / month (฿490 / month)',
        '• **Growth:** 500 documents / month (฿990 / month)',
        '• **Professional:** 1,500 documents / month (฿2,490 / month)',
      ],
    },
    th: {
      title: 'Monthly Plans',
      heading: 'เลือก Monthly Plans (แพ็กเกจรายเดือน)',
      body: [
        'ระบบจะตัดยอดและรีเซ็ตโควตาใหม่ทุกเดือน (ไม่มีการทบยอดคงเหลือ)',
        '• **ส่วนลด:** การเลือกชำระล่วงหน้าแบบรายปี จะได้รับส่วนลด **10%**',
        '• **Starter:** 200 เอกสาร / เดือน (฿490 / เดือน)',
        '• **Growth:** 500 เอกสาร / เดือน (฿990 / เดือน)',
        '• **Professional:** 1,500 เอกสาร / เดือน (฿2,490 / เดือน)',
      ],
    },
  },
  {
    screen: 2,
    spot: 'topup-credits',
    icon: Coins,
    en: {
      title: 'Top-Up Credits',
      heading: 'Choose Top-Up Credits',
      body: [
        'A one-time purchase of quota that never expires (1 credit covers 1 document page).',
        '• **500 Credits:** ฿2,000 (฿4.00 per page on average)',
        '• **2,500 Credits:** ฿7,500 (฿3.00 per page on average)',
        '• **10,000 Credits:** ฿20,000 (฿2.00 per page on average)',
      ],
    },
    th: {
      title: 'Top-Up Credits',
      heading: 'เลือก Top-Up Credits (แพ็กเกจเติมโควตา)',
      body: [
        'ซื้อโควตาแบบครั้งเดียว ไม่มีวันหมดอายุ (โดย 1 Credit เท่ากับเอกสาร 1 หน้า)',
        '• **500 Credits:** ฿2,000 (เฉลี่ย ฿4.00/หน้า)',
        '• **2,500 Credits:** ฿7,500 (เฉลี่ย ฿3.00/หน้า)',
        '• **10,000 Credits:** ฿20,000 (เฉลี่ย ฿2.00/หน้า)',
      ],
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
        'Check and complete the **Billing Information** section, which is what the tax documents are issued against (Company Name, Tax ID, Branch, Address, Purchaser Name, Tel, Email).',
        'Check that the **Subtotal** in the **Order Summary** on the right is correct.',
        'Click **Continue to payment** to issue the Proforma Invoice.',
      ],
    },
    th: {
      title: 'ข้อมูลออกใบแจ้งหนี้',
      heading: 'กรอกข้อมูลการออกใบแจ้งหนี้และดำเนินการต่อ',
      body: [
        'ตรวจสอบและกรอกข้อมูลในส่วน **Billing Information** สำหรับการออกเอกสารทางภาษี (Company Name, Tax ID, Branch, Address, Purchaser Name, Tel, Email)',
        'ตรวจสอบความถูกต้องของยอดรวม (Subtotal) ในส่วน **Order Summary** ทางขวามือ',
        'คลิกปุ่ม **Continue to payment** เพื่อสร้างใบแจ้งหนี้ Proforma Invoice',
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
        'คลิก **Print / Save PDF** ที่มุมขวาบน เพื่อบันทึกเอกสารและนำไปดำเนินการเบิกจ่ายตามระเบียบของโรงแรม',
      ],
    },
  },
  {
    screen: 4,
    spot: 'pay-slip',
    icon: CloudUpload,
    en: {
      title: 'Attach the slip and confirm',
      heading: 'Attach proof of payment, then confirm',
      body: [
        'Once the transfer is made, drag the file or click to attach your proof of payment in the **Upload payment slip** box below the invoice, on this same screen.',
        'Check the attached file, then click **Confirm payment**. The details go to the Carmen team, who will add the credits to your account.',
      ],
    },
    th: {
      title: 'แนบสลิปและยืนยัน',
      heading: 'แนบหลักฐานการชำระเงินและยืนยัน',
      body: [
        'เมื่อดำเนินการชำระเงินแล้ว ให้ลากไฟล์หรือคลิกเพื่อแนบหลักฐานการโอนเงินที่ช่อง **Upload payment slip** ใต้ใบแจ้งหนี้ในหน้าจอเดียวกันนี้',
        'ตรวจสอบความถูกต้องของไฟล์ที่แนบ จากนั้นคลิกปุ่ม **Confirm payment** ระบบจะส่งข้อมูลไปยังทีมงาน Carmen และจะดำเนินการเพิ่มเครดิตลงในบัญชีของท่าน',
      ],
    },
  },
  {
    screen: 5,
    spot: 'pending-order',
    icon: CircleCheck,
    en: {
      title: 'If the slip is not attached yet',
      heading: 'Closed the page first? Finish it from Plans & Credits',
      body: [
        'If you left before attaching the slip, return to the **Plans & Credits** page in Carmen. The system shows a **"You have an unfinished order"** notice — drag the file or click to attach your proof of payment in the **Upload payment slip** box, then confirm as usual.',
        "**Ready to buy for real?** Press **'Buy a package'** below to close this guide and choose your plan.",
      ],
    },
    th: {
      title: 'หากยังไม่ได้แนบสลิป',
      heading: 'ปิดหน้าจอไปก่อน? กลับมาทำต่อได้ที่หน้า Plans & Credits',
      body: [
        'หากปิดหน้าจอไปก่อนแนบหลักฐาน ให้กลับมาที่หน้า **Plans & Credits** ในระบบ Carmen ระบบจะแสดงข้อความแจ้งเตือน **"You have an unfinished order"** ให้ทำการลากไฟล์หรือคลิกเพื่อแนบหลักฐานการโอนเงินที่ช่อง **Upload payment slip** แล้วยืนยันได้เช่นเดิม',
        "**พร้อมสั่งซื้อจริงแล้วใช่ไหม?** กดปุ่ม **'ซื้อ Package'** ด้านล่าง เพื่อปิดคู่มือและเลือกแพ็กเกจได้ทันที",
      ],
    },
  },
]
