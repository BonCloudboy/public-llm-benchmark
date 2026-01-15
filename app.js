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
const statsGrid = document.getElementById('statsGrid');
const statsStatus = document.getElementById('statsStatus');

const dataBase = 'benchmarks';
let benchmarks = [];
let currentBenchmark = null;
let leaderboardData = null;
let leaderboardSets = [];
let activeLeaderboardId = null;
let runsData = [];
let pageSize = 50;
let currentPage = 1;
let statsRequestId = 0;

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

function setStatsStatus(message) {
  if (!statsStatus) return;
  statsStatus.textContent = message;
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

function renderStatsCard(title, items, emptyMessage) {
  const rows = items.length
    ? items
        .map(
          (item, index) => `
            <li class="stats-row">
              <span class="stat-rank">#${index + 1}</span>
              <span class="stat-label">${item.label}</span>
              <span class="stat-value">${item.value}</span>
            </li>
          `
        )
        .join('')
    : `<li class="stat-empty">${emptyMessage}</li>`;

  return `
    <div class="stats-card">
      <h3>${title}</h3>
      <ol class="stats-list">
        ${rows}
      </ol>
    </div>
  `;
}

function computeComeback(match, rounds) {
  const winnerId = match.winner_id;
  const player1Id = match.player1?.id;
  const player2Id = match.player2?.id;
  if (!winnerId || !player1Id || !player2Id) return null;

  let player1Score = 0;
  let player2Score = 0;
  let maxDeficit = 0;

  rounds.forEach((round) => {
    if (round.winner_id === player1Id) {
      player1Score += 1;
    } else if (round.winner_id === player2Id) {
      player2Score += 1;
    }

    const deficit =
      winnerId === player1Id ? player2Score - player1Score : player1Score - player2Score;
    if (deficit > maxDeficit) {
      maxDeficit = deficit;
    }
  });

  if (maxDeficit <= 0) return null;

  const player1Name = match.player1?.display_name || 'Player 1';
  const player2Name = match.player2?.display_name || 'Player 2';
  const winnerName = winnerId === player1Id ? player1Name : player2Name;
  const finalScore = `${match.player1_score ?? 0}-${match.player2_score ?? 0}`;

  return {
    deficit: maxDeficit,
    rounds: rounds.length,
    label: `${player1Name} vs ${player2Name}`,
    value: `${maxDeficit} deficit → ${winnerName}`
  };
}

function computeStats(entries) {
  const modelStats = new Map();
  const longestMatches = [];

  const getModelStats = (player) => {
    const key = player.display_name;
    if (!modelStats.has(key)) {
      modelStats.set(key, {
        displayName: key,
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalRounds: 0,
        roundsMatches: 0,
        sweeps20: 0,
        wins20: 0,
        wins21: 0,
        comebacks: 0
      });
    }
    return modelStats.get(key);
  };

  entries.forEach(({ match }) => {
    if (!match?.player1 || !match?.player2) return;
    const player1 = match.player1;
    const player2 = match.player2;
    const player1Stats = getModelStats(player1);
    const player2Stats = getModelStats(player2);

    player1Stats.totalMatches += 1;
    player2Stats.totalMatches += 1;

    const rounds = Array.isArray(match.rounds) ? match.rounds : [];
    if (rounds.length) {
      player1Stats.totalRounds += rounds.length;
      player2Stats.totalRounds += rounds.length;
      player1Stats.roundsMatches += 1;
      player2Stats.roundsMatches += 1;
      longestMatches.push({ match, rounds: rounds.length });
    }

    const winnerId = match.winner_id;
    if (!winnerId) {
      player1Stats.draws += 1;
      player2Stats.draws += 1;
    } else if (winnerId === player1.id) {
      player1Stats.wins += 1;
      player2Stats.losses += 1;
    } else if (winnerId === player2.id) {
      player2Stats.wins += 1;
      player1Stats.losses += 1;
    }

    const player1Score = match.player1_score ?? 0;
    const player2Score = match.player2_score ?? 0;
    if (winnerId) {
      const winnerStats = winnerId === player1.id ? player1Stats : player2Stats;
      const winnerScore = winnerId === player1.id ? player1Score : player2Score;
      const loserScore = winnerId === player1.id ? player2Score : player1Score;

      if (winnerScore === 2 && loserScore === 0) {
        winnerStats.sweeps20 += 1;
        winnerStats.wins20 += 1;
      } else if (winnerScore === 2 && loserScore === 1) {
        winnerStats.wins21 += 1;
      }
    }

    if (winnerId && rounds.length) {
      const comeback = computeComeback(match, rounds);
      if (comeback) {
        const winnerStats = winnerId === player1.id ? player1Stats : player2Stats;
        winnerStats.comebacks += 1;
      }
    }
  });

  const models = Array.from(modelStats.values()).map((stats) => ({
    ...stats,
    avgRounds: stats.roundsMatches ? stats.totalRounds / stats.roundsMatches : 0,
    winRate: stats.totalMatches ? stats.wins / stats.totalMatches : 0,
    winShare20: stats.wins ? stats.wins20 / stats.wins : 0,
    winShare21: stats.wins ? stats.wins21 / stats.wins : 0
  }));

  return {
    totalMatches: entries.length,
    models,
    longestMatches
  };
}

function renderStats(stats) {
  if (!statsGrid) return;
  const models = stats.models;

  const mostAvgRounds = models
    .filter((model) => model.roundsMatches > 0)
    .slice()
    .sort((a, b) => b.avgRounds - a.avgRounds)
    .slice(0, 3)
    .map((model) => ({
      label: model.displayName,
      value: `${model.avgRounds.toFixed(1)} avg`
    }));

  const leastAvgRounds = models
    .filter((model) => model.roundsMatches > 0)
    .slice()
    .sort((a, b) => a.avgRounds - b.avgRounds)
    .slice(0, 3)
    .map((model) => ({
      label: model.displayName,
      value: `${model.avgRounds.toFixed(1)} avg`
    }));

  const longestGames = stats.longestMatches
    .slice()
    .sort((a, b) => b.rounds - a.rounds)
    .slice(0, 3)
    .map(({ match, rounds }) => {
      const player1 = match.player1?.display_name || 'Player 1';
      const player2 = match.player2?.display_name || 'Player 2';
      return {
        label: `${player1} vs ${player2}`,
        value: `${rounds} rounds`
      };
    });

  const mostSweeps = models
    .slice()
    .sort((a, b) => b.sweeps20 - a.sweeps20)
    .slice(0, 3)
    .map((model) => ({
      label: model.displayName,
      value: model.sweeps20
    }));

  const bestWinRate = models
    .filter((model) => model.totalMatches > 0)
    .slice()
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3)
    .map((model) => ({
      label: model.displayName,
      value: `${(model.winRate * 100).toFixed(0)}%`
    }));

  const worstWinRate = models
    .filter((model) => model.totalMatches > 0)
    .slice()
    .sort((a, b) => a.winRate - b.winRate)
    .slice(0, 3)
    .map((model) => ({
      label: model.displayName,
      value: `${(model.winRate * 100).toFixed(0)}%`
    }));

  const mostWinShare20 = models
    .filter((model) => model.wins > 0)
    .slice()
    .sort((a, b) => b.winShare20 - a.winShare20)
    .slice(0, 3)
    .map((model) => ({
      label: model.displayName,
      value: `${(model.winShare20 * 100).toFixed(0)}%`
    }));

  const mostWinShare21 = models
    .filter((model) => model.wins > 0)
    .slice()
    .sort((a, b) => b.winShare21 - a.winShare21)
    .slice(0, 3)
    .map((model) => ({
      label: model.displayName,
      value: `${(model.winShare21 * 100).toFixed(0)}%`
    }));

  const mostMatches = models
    .slice()
    .sort((a, b) => b.totalMatches - a.totalMatches)
    .slice(0, 3)
    .map((model) => ({
      label: model.displayName,
      value: model.totalMatches
    }));

  const mostComebacks = models
    .filter((model) => model.comebacks > 0)
    .slice()
    .sort((a, b) => b.comebacks - a.comebacks)
    .slice(0, 3)
    .map((model) => ({
      label: model.displayName,
      value: model.comebacks
    }));

  statsGrid.innerHTML = [
    renderStatsCard('Most average rounds', mostAvgRounds, 'No round data yet.'),
    renderStatsCard('Least average rounds', leastAvgRounds, 'No round data yet.'),
    renderStatsCard('Longest games', longestGames, 'No completed matches yet.'),
    renderStatsCard('Most clean 2-0 sweeps', mostSweeps, 'No sweeps yet.'),
    renderStatsCard('Wins that are 2-0', mostWinShare20, 'No wins yet.'),
    renderStatsCard('Wins that are 2-1', mostWinShare21, 'No wins yet.'),
    renderStatsCard('Most comebacks', mostComebacks, 'No comebacks yet.'),
    renderStatsCard('Best win rate', bestWinRate, 'No matches yet.'),
    renderStatsCard('Worst win rate', worstWinRate, 'No matches yet.'),
    renderStatsCard('Most matches played', mostMatches, 'No matches yet.')
  ].join('');
}

async function loadStats(benchmarkPath, runs) {
  if (!statsGrid || !statsStatus) return;
  const requestId = ++statsRequestId;
  statsGrid.innerHTML = '';
  setStatsStatus('Loading stats...');

  const completedRuns = runs.filter((run) => run.status === 'completed' && run.artifacts_ref);
  if (!completedRuns.length) {
    setStatsStatus('No completed runs yet.');
    return;
  }

  const artifactPromises = completedRuns.map(async (run) => {
    try {
      const response = await fetch(`${benchmarkPath}/${run.artifacts_ref}`);
      if (!response.ok) return null;
      const artifact = await response.json();
      return { run, match: artifact.match || null };
    } catch (error) {
      return null;
    }
  });

  const artifacts = await Promise.all(artifactPromises);
  if (requestId !== statsRequestId) return;
  const entries = artifacts.filter((entry) => entry && entry.match);

  if (!entries.length) {
    setStatsStatus('No stats available.');
    return;
  }

  const stats = computeStats(entries);
  renderStats(stats);
  setStatsStatus(`Stats based on ${stats.totalMatches} matches.`);
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
    await loadStats(benchmarkPath, runsData);
  } catch (error) {
    setStatus('Failed to load benchmark.');
    leaderboardTables.innerHTML = '<p>Unable to load leaderboard.</p>';
    runsList.innerHTML = '<p>Unable to load runs.</p>';
    setStatsStatus('Unable to load stats.');
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
