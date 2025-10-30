export const InventoryErrors = {
  NAME_DUP: "Nome já existe neste tenant",
  FACTOR_GT_ZERO: "factorToBase deve ser > 0",
  ONHAND_GTE_ZERO: "onHand deve ser >= 0",
  RECIPE_DUP_LINE: "Item duplicado na receita",
  RECIPE_QTY_GT_ZERO: "qtyBase deve ser > 0",
  UNIT_CHANGE_FORBIDDEN:
    "Alterar unidade exigiria migração de receitas existentes",
  INSUFFICIENT: "Saldo insuficiente para a operação",
  ITEM_NOT_FOUND: "Item não encontrado",
};
