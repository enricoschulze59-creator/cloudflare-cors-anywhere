if (url.search.includes('_rsc=') && response.headers.get('content-type')?.includes('text/x-component')) {
  // Direkte Response für RSC
}
