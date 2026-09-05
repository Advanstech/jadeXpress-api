async function testWiki() {
  const productName = "TM ROASTED DANDELION TEA 16'S: TEABAG";
  const category = "Supplements";

  const cleanName = productName.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanName.split(' ');
  
  const searchAttempts = [
    productName,
    cleanName,
    words.slice(0, 3).join(' '),
    words.slice(0, 2).join(' '),
    category || 'product'
  ];

  for (const attempt of searchAttempts) {
    if (!attempt || attempt.trim().length === 0) continue;
    try {
      console.log('Trying:', attempt);
      const query = encodeURIComponent(attempt.trim());
      const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrlimit=1&prop=pageimages&pithumbsize=1024&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      const pages = data?.query?.pages;
      if (pages) {
        const firstPageId = Object.keys(pages)[0];
        const imgUrl = pages[firstPageId]?.thumbnail?.source;
        if (imgUrl) {
           console.log('Found:', imgUrl);
           return;
        }
      }
    } catch (e) {
      console.log('Failed', e);
    }
  }
}
testWiki();
