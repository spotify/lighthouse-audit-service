import { retrieveWebsiteList, retrieveWebsiteTotal } from './db';
import { listResponseFactory } from '../listHelpers';
import { WebsiteListItem } from './models';

export const getWebsites = listResponseFactory<WebsiteListItem>(
  retrieveWebsiteList,
  retrieveWebsiteTotal,
);
