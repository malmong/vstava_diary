const { Client } = require('@notionhq/client');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID;

const TAG_COLORS = {
  '회상': '#4a7aab', '경험': '#4a7aab', '관찰': '#4a7aab',
  '트라우마': '#b05a5a', '감정': '#b05a5a',
  '가치관': '#7a5aab', '철학': '#7a5aab', '개념': '#7a5aab',
  '성장': '#5a8a5a', '극복': '#5a8a5a', '운동': '#5a8a5a',
  '브랜딩': '#c8a040', '표현': '#c8a040', '작업': '#c8a040',
};

function getColor(tags) {
  for (const tag of tags) {
    for (const [key, color] of Object.entries(TAG_COLORS)) {
      if (tag.includes(key)) return color;
    }
  }
  return '#555566';
}

function makeId(title) {
  return 'n_' + title.replace(/[^a-zA-Z0-9가-힣]/g, '_').slice(0, 15) + '_' + Date.now() % 10000;
}

async function main() {
  const client = new Client({ auth: process.env.NOTION_TOKEN });
  
  const response = await client.databases.query({
    database_id: DB_ID,
    sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
    page_size: 20,
  });

  const newNodes = [];
  const newEdges = [];

  for (const page of response.results) {
    const titleProp = page.properties['제목'] || page.properties['Name'] || page.properties['이름'];
    const title = titleProp?.title?.[0]?.plain_text || '무제';
    const tagProp = page.properties['태그'] || page.properties['Tags'];
    const tags = tagProp?.multi_select?.map(t => t.name) || [];
    const summaryProp = page.properties['페이지 요약'] || page.properties['Summary'];
    const summary = summaryProp?.rich_text?.[0]?.plain_text || '';
    const date = page.last_edited_time?.slice(0, 10) || '';

    const id = makeId(title);
    const color = getColor(tags);
    const desc = summary || `${date} 작성. 태그: ${tags.join(', ')}`;

    newNodes.push({ id, label: title.replace(/[\[\]]/g, '').trim(), r: 13, color, desc });
    newEdges.push({ from: 'core', to: id, color });
  }

  let html = fs.readFileSync('mind_graph.html', 'utf8');
  const existingIds = [...html.matchAll(/id:'([^']+)'/g)].map(m => m[1]);

  const filteredNodes = newNodes.filter(n => !existingIds.includes(n.id));
  const filteredEdges = newEdges.filter(e => !existingIds.includes(e.to));

  if (filteredNodes.length === 0) {
    console.log('새로운 노드 없음, 종료');
    return;
  }

  const nodeCode = filteredNodes.map(n =>
    `  { id:'${n.id}', label:'${n.label}', x:W/2+(Math.random()-0.5)*400, y:H/2+(Math.random()-0.5)*400, r:13, color:'${n.color}', desc:'${n.desc.replace(/'/g, "\\'")}' },`
  ).join('\n');

  const edgeCode = filteredEdges.map(e =>
    `  ['core','${e.to}',0.8,'${e.color}'],`
  ).join('\n');

  html = html.replace('// 노드 맵', `${nodeCode}\n  // 노드 맵`);
  html = html.replace('// 핵심 → 2차', `${edgeCode}\n  // 핵심 → 2차`);

  fs.writeFileSync('mind_graph.html', html);
  console.log(`노드 ${filteredNodes.length}개 추가 완료`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
