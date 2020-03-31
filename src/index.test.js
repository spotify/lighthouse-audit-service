import * as las from '.';

describe('external api', () => {
  const EXPECTED_METHODS = [
    'startServer',
    'getApp',
    'triggerAudit',
    'getAudit',
    'getAudits',
    'deleteAudit',
    'getWebsites',
    'getWebsiteByAuditId',
    'getWebsiteByUrl',
  ];

  const EXPECTED_MODELS = ['Audit', 'Website'];

  EXPECTED_METHODS.forEach(method => {
    it(`defines method ${method}`, () => {
      expect(las[method]).toEqual(expect.any(Function));
    });
  });

  EXPECTED_MODELS.forEach(model => {
    it(`defines model ${model}`, () => {
      expect(las[model].prototype).toBeDefined();
      expect(las[model].build).toBeDefined();
    });
  });
});
