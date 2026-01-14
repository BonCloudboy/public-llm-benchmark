const benchmarkSelect = document.getElementById('benchmarkSelect');
const metaName = document.getElementById('metaName');
const metaSchema = document.getElementById('metaSchema');
const metaGenerated = document.getElementById('metaGenerated');
const metaRunTypes = document.getElementById('metaRunTypes');
const metaDescription = document.getElementById('metaDescription');
const leaderboardTables = document.getElementById('leaderboardTables');
const runsList = document.getElementById('runsList');
const runDetail = document.getElementById('runDetail');
const tabsContainer = document.getElementById('leaderboardTabs');
const runSearch = document.getElementById('runSearch');
const pageSizeSelect = document.getElementById('pageSize');
const runsCount = document.getElementById('runsCount');
const prevPageButton = document.getElementById('prevPage');
const nextPageButton = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

const dataBase = 'benchmarks';
let benchmarks = [];
let currentBenchmark = null;
let leaderboardData = null;
let leaderboardSets = [];
let activeLeaderboardId = null;
let runsData = [];
let pageSize = 50;
let currentPage = 1;

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function setStatus(message) {
  metaName.textContent = message;
  metaSchema.textContent = '-';
  metaGenerated.textContent = '-';
  metaRunTypes.textContent = '-';
  metaDescription.textContent = '';
}

function clearRunDetail() {
  runDetail.innerHTML = '';
  runDetail.classList.add('hidden');
}

function renderLeaderboard(setId) {
  if (!leaderboardData || !Array.isArray(leaderboardSets)) {
    leaderboardTables.innerHTML = '<p>No leaderboard data found.</p>';
    return;
  }

  const activeSet = leaderboardSets.find((set) => set.id === setId) || leaderboardSets[0];
  if (!activeSet) {
    leaderboardTables.innerHTML = '<p>No leaderboard entries available.</p>';
    return;
  }

  const entries = activeSet.entries || [];
  if (entries.length === 0) {
    leaderboardTables.innerHTML = '<p>No leaderboard entries available.</p>';
    return;
  }

  const rows = entries
    .map(
      (entry) => `
        <tr>
          <td>${entry.rank}</td>
          <td>${entry.display_name}</td>
          <td>${entry.rating.toFixed ? entry.rating.toFixed(2) : entry.rating}</td>
          <td>${entry.games_played}</td>
          <td>${entry.wins}</td>
          <td>${entry.losses}</td>
          <td>${entry.draws}</td>
          <td>${entry.win_rate}%</td>
        </tr>
      `
    )
    .join('');

  leaderboardTables.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Model</th>
          <th>Rating</th>
          <th>Games</th>
          <th>Wins</th>
          <th>Losses</th>
          <th>Draws</th>
          <th>Win Rate</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderRunsList(runs, benchmarkPath) {
  const pagedRuns = paginateRuns(runs);
  updateRunsMeta(runs.length);

  if (pagedRuns.length === 0) {
    runsList.innerHTML = '<p>No runs available.</p>';
    return;
  }

  runsList.innerHTML = pagedRuns
    .map((run) => {
      const participants = (run.participants || [])
        .map((p) => p.display_name)
        .join(' vs ');
      const status = run.status || 'unknown';
      const matchType = run.match_type ? run.match_type.toUpperCase() : 'RUN';
      return `
        <div class="run-card" data-artifact="${run.artifacts_ref || ''}" data-benchmark="${benchmarkPath}">
          <div><strong>${participants || 'Run ' + run.run_id}</strong></div>
          <div class="run-meta">
            <span class="badge">${matchType}</span>
            <span>Status: ${status}</span>
            <span>Created: ${formatDate(run.created_at)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  runsList.querySelectorAll('.run-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const artifactRef = card.getAttribute('data-artifact');
      const benchmarkPathAttr = card.getAttribute('data-benchmark');
      if (!artifactRef || !benchmarkPathAttr) return;
      await loadRunDetail(`${benchmarkPathAttr}/${artifactRef}`);
    });
  });
}

function updateRunsMeta(total) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  runsCount.textContent = `${total} runs`;
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevPageButton.disabled = currentPage <= 1;
  nextPageButton.disabled = currentPage >= totalPages;
}

function paginateRuns(runs) {
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  return runs.slice(start, end);
}

function filterRuns(runs) {
  const query = runSearch.value.trim().toLowerCase();
  if (!query) return runs;
  return runs.filter((run) => {
    const participants = (run.participants || []).map((p) =>
      `${p.provider}/${p.model_name}`.toLowerCase()
    );
    return participants.some((name) => name.includes(query));
  });
}

async function loadRunsFile(benchmarkPath) {
  const response = await fetch(`${benchmarkPath}/runs.jsonl`);
  if (!response.ok) {
    throw new Error('Failed to load runs file.');
  }
  const text = await response.text();
  const runs = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  runs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return runs;
}

function updateRunsView(benchmarkPath) {
  const filtered = filterRuns(runsData);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  renderRunsList(filtered, benchmarkPath);
}

async function loadRunDetail(artifactPath) {
  try {
    const response = await fetch(artifactPath);
    if (!response.ok) {
      throw new Error('Failed to load run details.');
    }
    const artifact = await response.json();
    const match = artifact.match || {};
    const rounds = match.rounds || [];

    runDetail.innerHTML = `
      <h3>Run Detail</h3>
      <p><strong>Match:</strong> ${match.player1?.display_name || '-'} vs ${match.player2?.display_name || '-'}</p>
      <p><strong>Status:</strong> ${match.status || '-'}</p>
      <p><strong>Winner:</strong> ${match.winner?.display_name || 'Draw'}</p>
      <p><strong>Rounds:</strong> ${rounds.length}</p>
      <div class="run-meta">
        <span>Created: ${formatDate(match.created_at)}</span>
        <span>Completed: ${formatDate(match.completed_at)}</span>
      </div>
    `;
    runDetail.classList.remove('hidden');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load run details.';
    runDetail.innerHTML = `<p class="error">${message}</p>`;
    runDetail.classList.remove('hidden');
  }
}

async function loadBenchmark(benchmark) {
  if (!benchmark) return;
  currentBenchmark = benchmark;
  clearRunDetail();

  const benchmarkPath = benchmark.path;
  setStatus('Loading...');

  try {
    const [metaRes, leaderboardRes, runsRes] = await Promise.all([
      fetch(`${benchmarkPath}/benchmark.json`),
      fetch(`${benchmarkPath}/leaderboard.json`),
      loadRunsFile(benchmarkPath)
    ]);

    if (!metaRes.ok || !leaderboardRes.ok) {
      throw new Error('Failed to load benchmark data.');
    }

    const meta = await metaRes.json();
    leaderboardData = await leaderboardRes.json();
    runsData = runsRes;
    leaderboardSets = Array.isArray(leaderboardData.sets) ? leaderboardData.sets : [];
    activeLeaderboardId = leaderboardSets[0]?.id || null;

    metaName.textContent = meta.name || benchmark.name;
    metaSchema.textContent = meta.schema_version ?? '-';
    metaGenerated.textContent = formatDate(meta.generated_at);
    metaRunTypes.textContent = Array.isArray(meta.run_types) ? meta.run_types.join(', ') : '-';
    metaDescription.textContent = meta.description || '';

    renderTabs();
    if (activeLeaderboardId) {
      renderLeaderboard(activeLeaderboardId);
    } else {
      leaderboardTables.innerHTML = '<p>No leaderboard entries available.</p>';
    }
    currentPage = 1;
    updateRunsView(benchmarkPath);
  } catch (error) {
    setStatus('Failed to load benchmark.');
    leaderboardTables.innerHTML = '<p>Unable to load leaderboard.</p>';
    runsList.innerHTML = '<p>Unable to load runs.</p>';
  }
}

function renderTabs() {
  if (!tabsContainer) return;
  tabsContainer.innerHTML = '';
  if (!leaderboardSets.length) {
    return;
  }

  leaderboardSets.forEach((set) => {
    const button = document.createElement('button');
    button.className = `tab${set.id === activeLeaderboardId ? ' active' : ''}`;
    button.dataset.tab = set.id;
    button.textContent = set.label || set.id;
    button.addEventListener('click', () => {
      activeLeaderboardId = set.id;
      Array.from(tabsContainer.querySelectorAll('.tab')).forEach((tab) =>
        tab.classList.toggle('active', tab.dataset.tab === activeLeaderboardId)
      );
      renderLeaderboard(activeLeaderboardId);
    });
    tabsContainer.appendChild(button);
  });
}

async function loadBenchmarks() {
  try {
    const response = await fetch(`${dataBase}/index.json`);
    if (!response.ok) {
      throw new Error('Failed to load benchmark index.');
    }
    const data = await response.json();
    benchmarks = data.benchmarks || [];

    benchmarkSelect.innerHTML = benchmarks
      .map(
        (benchmark, index) =>
          `<option value="${benchmark.benchmark_id}" ${index === 0 ? 'selected' : ''}>
            ${benchmark.name}
          </option>`
      )
      .join('');

    if (benchmarks.length > 0) {
      await loadBenchmark(benchmarks[0]);
    } else {
      setStatus('No benchmarks found.');
    }
  } catch (error) {
    setStatus('Unable to load benchmarks.');
  }
}

benchmarkSelect.addEventListener('change', () => {
  const selected = benchmarks.find(
    (benchmark) => benchmark.benchmark_id === benchmarkSelect.value
  );
  loadBenchmark(selected);
});

runSearch.addEventListener('input', () => {
  currentPage = 1;
  updateRunsView(currentBenchmark?.path);
});

pageSizeSelect.addEventListener('change', () => {
  pageSize = parseInt(pageSizeSelect.value, 10) || 50;
  currentPage = 1;
  updateRunsView(currentBenchmark?.path);
});

prevPageButton.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    updateRunsView(currentBenchmark?.path);
  }
});

nextPageButton.addEventListener('click', () => {
  currentPage += 1;
  updateRunsView(currentBenchmark?.path);
});

loadBenchmarks();
