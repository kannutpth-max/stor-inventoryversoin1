## ปัญหา
Google Sheets คืนค่าคอลัมน์วันที่เป็น serial number (เช่น `"45631"`) แทน string `yyyy-MM-dd` ทำให้ `new Date("45631")` ตีความเป็น ค.ศ. 45631 แล้วบวก 543 = พ.ศ. 46174

## วิธีแก้ (ไม่กระทบโครงสร้าง/ฟังก์ชันเดิม)

**1. เพิ่ม helper `parseSheetDate` ใน `src/lib/utils.ts`**
```ts
export function parseSheetDate(v: string | number | Date): Date {
  if (v instanceof Date) return v;
  const s = String(v).trim();
  // Excel/Sheets serial number (days since 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }
  return new Date(s);
}
```

**2. ใช้ helper แทน `new Date(...)` เฉพาะจุดที่อ่านวันที่จากชีต:**
- `src/pages/StockIn.tsx` บรรทัด 85: `setDate(parseSheetDate(first.date))`
- `src/pages/StockInManagement.tsx` `formatDate` (บรรทัด 118-120)
- `src/pages/StockOut.tsx` — จุดโหลด edit mode ที่ setDate จาก record
- `src/pages/StockOutManagement.tsx` — `formatDate` เช่นเดียวกัน

**3. ไม่แตะ logic บันทึก** (`format(date, "yyyy-MM-dd")` ยังคงเดิม) และไม่แตะ edge function

## ผลลัพธ์
- วันที่ในหน้าแก้ไข และหน้าจัดการรายการ แสดง พ.ศ. ตรงกับความเป็นจริง
- รายการเดิมที่ถูกบันทึกเป็น serial number จะถูกแปลงถูกต้อง
- โครงสร้าง UI, การบันทึก, ตัด/คืนสต็อก คงเดิม 100%