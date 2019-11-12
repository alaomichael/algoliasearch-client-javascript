import algoliasearch from '../../../../algoliasearch/src/builds/node';

const analyticsClient = algoliasearch('appId', 'apiKey').initAnalytics();

describe('analytics client', () => {
  it('uses region to define the host', () => {
    expect(analyticsClient.transporter.hosts[0].url).toBe('analytics.us.algolia.com');
  });

  it('sets default headers', () => {
    expect(analyticsClient.transporter.headers).toEqual({
      'content-type': 'application/json',
      'x-algolia-application-id': 'appId',
      'x-algolia-api-key': 'apiKey',
    });

    expect(analyticsClient.transporter.queryParameters).toEqual({});
  });
});