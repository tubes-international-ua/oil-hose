// Renders /product?p=<slug> from window.FOOD_PRODUCTS (js/food-products.js)
document.addEventListener('DOMContentLoaded', function () {
  var data = window.FOOD_PRODUCTS || {};
  var slug = new URLSearchParams(location.search).get('p');
  var product = data[slug];
  var LABELS = {
    milk: 'Молоко', fats: 'Жири та олії', alcohol: 'Спирт', beer: 'Пиво', wine: 'Вино',
    juice: 'Соки та напої', water: 'Питна вода', purity: 'Фарма та косметика',
    chem: 'Хімія для миття', acc: 'Аксесуари'
  };

  function field(name) {
    return document.querySelector('[data-field="' + name + '"]');
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function tags(cats) {
    var box = document.createDocumentFragment();
    cats.forEach(function (cat) {
      if (LABELS[cat]) box.appendChild(el('span', '', LABELS[cat]));
    });
    return box;
  }

  if (!product) {
    document.querySelector('.pdp-missing').hidden = false;
    return;
  }

  var material = (product.attrs.find(function (a) { return a[0] === 'Матеріал'; }) || [])[1] || '';
  var heading = product.name.indexOf(product.model) === -1 ? product.model + ' — ' + product.name : product.name;
  document.title = heading + ' | Tubes International';
  document.querySelector('meta[name="description"]').setAttribute('content', product.lead);

  // Canonical keeps only ?p=, so utm/gclid variants of the same product collapse into one URL
  var canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = 'https://food-hose.tubes-international.com.ua/product?p=' + encodeURIComponent(slug);
  document.head.appendChild(canonical);

  field('model').textContent = product.model;
  field('name').textContent = product.name;
  field('lead').textContent = product.lead;
  field('material').textContent = material.split(' – ').pop();
  if (!material) field('material').hidden = true;
  field('tags').appendChild(tags(product.cats));
  field('photo').src = '/img/food/products/large/' + slug + '.webp';
  field('photo').alt = product.name;
  field('ask').dataset.product = product.model;
  field('body').textContent = product.body;
  field('norms').textContent = product.norms;
  if (!product.norms) field('norms').parentNode.hidden = true;

  product.attrs.forEach(function (attr) {
    var tr = el('tr');
    tr.appendChild(el('th', '', attr[0]));
    tr.appendChild(el('td', '', attr[1]));
    field('attrs').appendChild(tr);
  });

  // Variant rows: [SKU, name, DN, BAR, datasheet PDF]
  product.rows.forEach(function (row) {
    var tr = el('tr');
    [['Артикул', row[0]], ['Назва', row[1]], ['DN', row[2]], ['BAR', row[3]]].forEach(function (cell) {
      var td = el('td', '', cell[1]);
      td.dataset.label = cell[0];
      tr.appendChild(td);
    });
    var pdf = el('td');
    pdf.dataset.label = 'Каталог';
    if (row[4]) {
      var link = el('a', 'variants__pdf', 'PDF');
      link.href = row[4];
      link.target = '_blank';
      link.rel = 'noopener';
      pdf.appendChild(link);
    } else {
      pdf.textContent = '—';
    }
    tr.appendChild(pdf);
    var action = el('td');
    var ask = el('a', 'btn btn--outline-dark btn--sm', 'Запит');
    ask.href = '#request';
    ask.dataset.product = product.model + ', артикул ' + row[0] + ' (' + row[1] + ')';
    action.appendChild(ask);
    tr.appendChild(action);
    field('rows').appendChild(tr);
  });

  // Related: products sharing the most application categories
  Object.keys(data)
    .filter(function (key) { return key !== slug; })
    .map(function (key) {
      var shared = data[key].cats.filter(function (c) { return product.cats.indexOf(c) !== -1; }).length;
      return { key: key, score: shared };
    })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, 3)
    .forEach(function (item) {
      var p = data[item.key];
      var url = '/product?p=' + item.key;
      var card = el('article', 'product');
      var img = el('a', 'product__img');
      img.href = url;
      var pic = el('img');
      pic.src = '/img/food/products/' + item.key + '.webp';
      pic.alt = p.name;
      pic.loading = 'lazy';
      img.appendChild(pic);
      var body = el('div', 'product__body');
      body.appendChild(el('div', 'product__cat', ((p.attrs[0] || [])[1] || '').split(' – ').pop()));
      var title = el('h4');
      var titleLink = el('a', '', p.model);
      titleLink.href = url;
      title.appendChild(titleLink);
      body.appendChild(title);
      body.appendChild(el('p', '', p.lead));
      var tagBox = el('div', 'product__tags');
      tagBox.appendChild(tags(p.cats));
      body.appendChild(tagBox);
      var more = el('a', 'btn btn--outline-dark btn--sm', 'Детальніше');
      more.href = url;
      body.appendChild(more);
      card.appendChild(img);
      card.appendChild(body);
      field('related').appendChild(card);
    });

  document.querySelectorAll('.pdp-section').forEach(function (node) {
    node.hidden = false;
  });
});
