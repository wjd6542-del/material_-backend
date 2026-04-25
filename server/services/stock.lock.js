/**
 * Stock 행 잠금 유틸 (MySQL InnoDB `SELECT ... FOR UPDATE`).
 *
 * 같은 재고 셀(material+warehouse+location+shelf) 에 대한
 * read-modify-write 동시성에서 lost update 와
 * StockHistory before/after 불일치를 막기 위해 사용한다.
 * 반드시 prisma.$transaction 의 인터랙티브 트랜잭션(tx) 안에서 호출해야 하며,
 * 락은 해당 트랜잭션 커밋/롤백 시점까지 유지된다.
 */

/**
 * id 로 Stock 행을 잠그고 최신 값(quantity, avg_cost)을 반환.
 * 존재하지 않으면 null.
 */
export async function lockStockById(tx, id) {
  const rows = await tx.$queryRaw`
    SELECT id, quantity, avg_cost
    FROM \`Stock\`
    WHERE id = ${id}
    FOR UPDATE
  `;
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  return {
    id: Number(row.id),
    quantity: Number(row.quantity),
    avg_cost: Number(row.avg_cost ?? 0),
  };
}

/**
 * uniqueKey 위치의 Stock 행을 보장(없으면 quantity 0 으로 생성)한다. 잠금은 걸지 않는다.
 * 동시 삽입은 unique constraint 로 직렬화된다.
 * 단독으로 사용 시 이후 lockStockById 로 별도 잠금이 필요하다.
 */
export async function ensureStockRow(tx, uniqueKey, userId) {
  const normalizedKey = {
    material_id: uniqueKey.material_id,
    warehouse_id: uniqueKey.warehouse_id,
    location_id: uniqueKey.location_id,
    shelf_id: uniqueKey.shelf_id ?? null,
  };

  return tx.stock.upsert({
    where: {
      material_id_warehouse_id_location_id_shelf_id: normalizedKey,
    },
    update: { updated_by: userId },
    create: {
      ...normalizedKey,
      quantity: 0,
      avg_cost: 0,
      stock_value: 0,
      updated_by: userId,
    },
  });
}

/**
 * uniqueKey 위치의 Stock 행을 보장한 뒤 FOR UPDATE 로 잠근다.
 * 단일 셀만 다룰 때 사용. 여러 셀을 동시에 잠가야 하면 deadlock 방지를 위해
 * ensureStockRow + lockStockById 를 id 오름차순으로 호출할 것.
 */
export async function ensureAndLockStock(tx, uniqueKey, userId) {
  const stock = await ensureStockRow(tx, uniqueKey, userId);
  const locked = await lockStockById(tx, stock.id);
  if (!locked) {
    throw new Error(`Stock 행 잠금 실패 (id=${stock.id})`);
  }
  return locked;
}
