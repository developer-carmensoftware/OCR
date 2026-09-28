-- CA-109: Micro is ฿450 (฿4.50/credit), not the ฿490 shipped in 20260924010000.
-- Still above pack_small's ฿4.00/credit, so five Micros never beat one Small.
update credit_packs set price_thb = 450.00 where code = 'pack_micro';
