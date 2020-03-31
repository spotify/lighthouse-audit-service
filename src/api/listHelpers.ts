import SQL, { SQLStatement } from 'sql-template-strings';

import { DbConnectionType } from '../db';
import { InvalidRequestError } from '../errors';

export interface ListRequest {
  limit?: number;
  offset?: number;
  where?: SQLStatement;
}

export interface ListResponse<Item> extends ListRequest {
  items: Item[];
  total: number;
}

export type ListItemsGetter<Item> = (
  conn: DbConnectionType,
  options: ListRequest,
) => Promise<Item[]>;
export type ListTotalGetter = (conn: DbConnectionType) => Promise<number>;

export async function getListAsListResponse<Item>(
  conn: DbConnectionType,
  options: ListRequest,
  itemsGetter: ListItemsGetter<Item>,
  totalGetter: ListTotalGetter,
): Promise<ListResponse<Item>> {
  const [items, total] = await Promise.all([
    itemsGetter(conn, options),
    totalGetter(conn),
  ]);
  const { limit, offset } = options;
  return { items, total, limit, offset };
}

export function listResponseFactory<Item>(
  itemsGetter: ListItemsGetter<Item>,
  totalGetter: ListTotalGetter,
) {
  return async (conn: DbConnectionType, options: ListRequest) =>
    await getListAsListResponse(conn, options, itemsGetter, totalGetter);
}

export function listOptionsFromQuery(
  query: Record<string, string>,
  defaultLimit = 25,
  defaultOffset = 0,
): ListRequest {
  const {
    limit: limitStr = defaultLimit,
    offset: offsetStr = defaultOffset,
  } = query;
  const limit = +limitStr;
  const offset = +offsetStr;

  if (isNaN(limit)) throw new InvalidRequestError(`limit must be a number.`);
  if (isNaN(offset)) throw new InvalidRequestError(`offset must be a number.`);

  return { limit, offset };
}

export function addListRequestToQuery(
  query: SQLStatement,
  request: ListRequest,
): SQLStatement {
  if (typeof request.limit === 'number')
    query.append(SQL`\nLIMIT ${request.limit}`);
  if (typeof request.offset === 'number')
    query.append(SQL`\nOFFSET ${request.offset}`);
  return query;
}
