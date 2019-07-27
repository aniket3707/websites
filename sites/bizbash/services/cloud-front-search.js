const fetch = require('node-fetch');
const querystring = require('querystring');
const { buildImgixUrl } = require('@base-cms/image');
const { get } = require('@base-cms/object-path');

const { CDN_IMAGE_HOSTNAME = 'base.imgix.net' } = process.env;
const API_URI = 'https://nwmj632le8.execute-api.us-east-1.amazonaws.com/test';

const addFacetUrlParams = (urlParams, type, facets) => {
  const params = urlParams;
  const fq = [`(term field=type '${type}')`];
  Object.entries(facets).forEach(([key, value]) => {
    if (value) {
      fq.push(`(term field=${key} '${value}')`);
      params[`facet.${key}`] = "{sort:'bucket', size:500}";
    }
  });
  params.fq = `(and ${fq.join(' ')})`;
  return params;
};

const validateSearch = (urlParams) => {
  const params = urlParams;
  if (!params.q) {
    params.q = 'matchall';
    params['q.parser'] = 'structured';
  }
  return params;
};

const search = async ({
  phrase,
  pageNumber = 1,
  size = 25,
  sort = 'featured desc, modified desc',
  contentType,
  exprFeatured = '_score*((_time > featured_start && _time < featured_end) ? 100 : 1)',
}) => {
  const start = (pageNumber - 1) * size;
  const params = {
    size,
    start,
    sort,
    'expr.featured': exprFeatured,
  };
  if (!phrase) {
    // No search phrase, match all.
    params.q = 'matchall';
    params['q.parser'] = 'structured';
  } else {
    // Set search phrase
    params.q = phrase;
  }
  const fq = [];
  fq.push(`(term field=type '${contentType}')`);
  params.fq = `(and ${fq.join(' ')})`;

  const url = `${API_URI}?${querystring.stringify(params)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(res.statusMessage);
    err.statusCode = res.statusText;
    throw err;
  }
  return res.json();
};

const retrieveResults = async ({
  api,
  urlParams,
  type,
  facets,
}) => {
  let params = urlParams;
  if (params.page === 1) delete params.page;
  if (!params.q) delete params.q;
  params = addFacetUrlParams(params, type, facets);
  params = validateSearch(params);
  const queryString = Object.keys(params).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(urlParams[key])}`).join('&');
  const url = `${api}?${queryString}`;
  const response = await fetch(url);
  if (!response.ok) {
    const err = new Error(response.statusMessage);
    err.statusCode = response.statusText;
    throw err;
  }
  return response.json();
};

const generateUrlWithQueryString = (url, params) => {
  const queryString = [];
  Object.entries(params).forEach(([key, value]) => {
    queryString.push(`${key}=${value}`);
  });
  return `${url}?${queryString.join('&')}`;
};

const getFacetUrl = (req, param, id) => {
  const currentQuery = Object.assign({}, req.query);
  delete currentQuery.page;
  if (!currentQuery.q) delete currentQuery.q;
  if (id === Number(req.query[param.toLowerCase()])) {
    delete currentQuery[param.toLowerCase()];
  } else {
    currentQuery[param.toLowerCase()] = id;
  }
  return generateUrlWithQueryString(req.path, currentQuery);
};

const generateResultImage = (result, options) => {
  const primaryImage = get(result, 'fields.primaryimage');
  const src = primaryImage ? primaryImage.replace('cdn.bizbash.com', CDN_IMAGE_HOSTNAME).replace('320w/', '') : `https://${CDN_IMAGE_HOSTNAME}/files/base/bizbash/bzb/image/2019/01/bizbash_placeholder.5c3778bf1e44d.png`;
  return buildImgixUrl(src, options);
};

const getPaginationLink = (req, increment, pageSize, total) => {
  const currentPage = req.query.page ? req.query.page : 1;
  const newPage = Number(currentPage) + Number(increment);
  if (newPage <= 0 || newPage * pageSize >= total) {
    return '';
  }

  const currentQuery = Object.assign({}, req.query);
  currentQuery.page = newPage;
  return generateUrlWithQueryString(req.path, currentQuery);
};

const getPaginationInfo = (start, pageSize, total) => {
  const end = Number(start) + Number(pageSize);
  return end >= Number(total) ? `Showing ${start} - ${total} of ${total}` : `Showing ${start} - ${end} of ${total}`;
};

module.exports = {
  search,
  retrieveResults,
  getFacetUrl,
  generateResultImage,
  getPaginationInfo,
  getPaginationLink,
};
