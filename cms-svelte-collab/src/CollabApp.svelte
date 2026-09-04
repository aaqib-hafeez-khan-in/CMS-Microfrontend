<script lang="ts">
  import { onMount } from 'svelte';

  type Role = 'Administrator' | 'Editor' | 'Contributor';
  type ActivityType = 'article:created' | 'article:updated' | 'article:status_changed' | 'article:published' | 'article:deleted' | 'media:uploaded' | 'media:deleted' | 'comment:created' | 'comment:resolved' | 'auth:login' | 'auth:logout';

  interface Article {
    id: string;
    title: string;
    author?: string;
    status?: string;
  }

  interface Comment {
    id: string;
    articleId: string;
    articleTitle: string;
    author: string;
    role: Role;
    body: string;
    createdAt: string;
    updatedAt?: string;
    resolved: boolean;
    mentions: string[];
  }

  interface Activity {
    id: string;
    type: ActivityType;
    articleId?: string;
    articleTitle?: string;
    actor: string;
    timestamp: string;
    detail: string;
  }

  interface Session {
    name: string;
    role: Role;
  }

  const COMMENTS_KEY = 'cms_collaboration_comments';
  const ACTIVITY_KEY = 'cms_collaboration_activity';
  const ARTICLES_KEY = 'cms_articles';
  const SESSION_KEY = 'cms_session';
  const USERS = ['Admin User', 'Editor User', 'Contributor User', 'Maya Chen', 'Alex Morgan'];
  const EVENT_TYPES: ActivityType[] = ['article:created', 'article:updated', 'article:status_changed', 'article:published', 'article:deleted', 'media:uploaded', 'media:deleted', 'comment:created', 'comment:resolved', 'auth:login', 'auth:logout'];

  let comments: Comment[] = [];
  let activities: Activity[] = [];
  let articles: Article[] = [];
  let currentUser: Session = { name: 'Admin User', role: 'Administrator' };
  let selectedArticleId = '';
  let newComment = '';
  let editingId = '';
  let editingBody = '';
  let activityArticle = 'All';
  let activityActor = 'All';
  let activityType = 'All';
  let activityOpen = false;
  let loading = true;
  let error = '';
  let mentionQuery = '';
  let mentionOpen = false;

  $: selectedArticle = articles.find(article => article.id === selectedArticleId);
  $: articleComments = comments.filter(comment => comment.articleId === selectedArticleId);
  $: filteredActivities = activities.filter(item =>
    (activityArticle === 'All' || item.articleId === activityArticle) &&
    (activityActor === 'All' || item.actor === activityActor) &&
    (activityType === 'All' || item.type === activityType)
  );
  $: actors = Array.from(new Set(activities.map(item => item.actor))).sort();
  $: mentionMatches = USERS.filter(user => user.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);

  onMount(() => {
    try {
      currentUser = readSession();
      articles = readArticles();
      comments = readComments();
      activities = readActivities();
      if (!selectedArticleId && articles.length) selectedArticleId = articles[0].id;
      window.addEventListener('storage', handleStorage);
      EVENT_TYPES.forEach(type => window.addEventListener(type, handleCmsEvent as EventListener));
    } catch {
      error = 'Collaboration data could not be loaded. Stored data may be unavailable or corrupted.';
    } finally {
      loading = false;
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      EVENT_TYPES.forEach(type => window.removeEventListener(type, handleCmsEvent as EventListener));
    };
  });

  function readSession(): Session {
    try {
      const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      const user = raw.user || {};
      const role = user.role || raw.role || 'Contributor';
      return { name: user.name || user.email || raw.name || 'Current User', role: role as Role };
    } catch {
      return { name: 'Current User', role: 'Contributor' };
    }
  }

  function readArticles(): Article[] {
    try {
      const raw = JSON.parse(localStorage.getItem(ARTICLES_KEY) || '[]');
      return Array.isArray(raw) ? raw.map((item: Article) => ({ id: String(item.id), title: item.title || 'Untitled article', author: item.author, status: item.status })) : [];
    } catch {
      return [];
    }
  }

  function readComments(): Comment[] {
    try {
      const raw = JSON.parse(localStorage.getItem(COMMENTS_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function readActivities(): Activity[] {
    try {
      const raw = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function persistComments() {
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
  }

  function persistActivities() {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities.slice(0, 200)));
  }

  function createId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function emit(type: ActivityType, detail: Record<string, unknown>) {
    window.dispatchEvent(new CustomEvent(type, { detail: { ...detail, source: 'cms-svelte-collab' } }));
  }

  function addActivity(type: ActivityType, detail: Record<string, unknown>) {
    const activity: Activity = {
      id: createId('activity'),
      type,
      articleId: detail.articleId as string | undefined,
      articleTitle: detail.articleTitle as string | undefined,
      actor: (detail.actor as string) || currentUser.name,
      timestamp: (detail.timestamp as string) || new Date().toISOString(),
      detail: (detail.detail as string) || formatEvent(type, detail)
    };
    activities = [activity, ...activities].slice(0, 200);
    persistActivities();
  }

  function formatEvent(type: ActivityType, detail: Record<string, unknown>) {
    const title = detail.articleTitle || 'an article';
    const actor = detail.actor || currentUser.name;
    if (type === 'article:created') return `${actor} created ${title}`;
    if (type === 'article:updated') return `${actor} edited ${title}`;
    if (type === 'article:status_changed') return `${actor} changed ${title} status to ${detail.status || 'updated'}`;
    if (type === 'article:published') return `${actor} published ${title}`;
    if (type === 'article:deleted') return `${actor} deleted ${title}`;
    if (type === 'media:uploaded') return `${actor} uploaded ${detail.name || 'media'}`;
    if (type === 'media:deleted') return `${actor} deleted ${detail.name || 'media'}`;
    if (type === 'comment:created') return `${actor} added a comment to ${title}`;
    if (type === 'comment:resolved') return `${actor} resolved a discussion in ${title}`;
    if (type === 'auth:login') return `${actor} signed in`;
    return `${actor} signed out`;
  }

  function handleCmsEvent(event: Event) {
    const custom = event as CustomEvent;
    const detail = custom.detail || {};
    const type = event.type as ActivityType;
    if (type.startsWith('auth:')) {
      currentUser = readSession();
    }
    if (type.startsWith('article:')) {
      articles = readArticles();
      if (!selectedArticleId && articles.length) selectedArticleId = articles[0].id;
    }
    addActivity(type, {
      ...detail,
      actor: detail.actor || detail.author || currentUser.name,
      articleTitle: detail.articleTitle || detail.title,
      timestamp: detail.updatedAt || detail.timestamp || new Date().toISOString()
    });
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === COMMENTS_KEY) comments = readComments();
    if (event.key === ACTIVITY_KEY) activities = readActivities();
    if (event.key === ARTICLES_KEY) {
      articles = readArticles();
      if (!articles.some(article => article.id === selectedArticleId)) selectedArticleId = articles[0]?.id || '';
    }
    if (event.key === SESSION_KEY) currentUser = readSession();
  }

  function selectArticle(id: string) {
    selectedArticleId = id;
    editingId = '';
    newComment = '';
  }

  function extractMentions(text: string): string[] {
    return Array.from(new Set((text.match(/@[A-Za-z][A-Za-z0-9._-]*/g) || []).map(value => value.slice(1))));
  }

  function updateMentionState(value: string) {
    newComment = value;
    const match = value.match(/(?:^|\s)@([A-Za-z0-9._-]*)$/);
    mentionQuery = match ? match[1] : '';
    mentionOpen = Boolean(match);
  }

  function chooseMention(name: string) {
    const index = newComment.lastIndexOf('@');
    newComment = `${newComment.slice(0, index)}@${name} `;
    mentionOpen = false;
    mentionQuery = '';
  }

  function canModerate(comment?: Comment) {
    return currentUser.role === 'Administrator' || currentUser.role === 'Editor' || comment?.author === currentUser.name;
  }

  function addComment() {
    if (!selectedArticleId || !newComment.trim()) return;
    const article = selectedArticle;
    if (!article) return;
    const comment: Comment = {
      id: createId('comment'),
      articleId: article.id,
      articleTitle: article.title,
      author: currentUser.name,
      role: currentUser.role,
      body: newComment.trim(),
      createdAt: new Date().toISOString(),
      resolved: false,
      mentions: extractMentions(newComment)
    };
    comments = [...comments, comment];
    persistComments();
    addActivity('comment:created', { articleId: article.id, articleTitle: article.title, actor: currentUser.name, timestamp: comment.createdAt });
    emit('comment:created', { commentId: comment.id, articleId: article.id, articleTitle: article.title, actor: currentUser.name, createdAt: comment.createdAt });
    newComment = '';
    mentionOpen = false;
  }

  function startEdit(comment: Comment) {
    if (!canModerate(comment)) return;
    editingId = comment.id;
    editingBody = comment.body;
  }

  function saveEdit(comment: Comment) {
    if (!canModerate(comment) || !editingBody.trim()) return;
    comments = comments.map(item => item.id === comment.id ? { ...item, body: editingBody.trim(), updatedAt: new Date().toISOString(), mentions: extractMentions(editingBody) } : item);
    persistComments();
    editingId = '';
    editingBody = '';
  }

  function deleteComment(comment: Comment) {
    if (!canModerate(comment)) return;
    comments = comments.filter(item => item.id !== comment.id);
    persistComments();
  }

  function toggleResolved(comment: Comment) {
    if (!canModerate(comment)) return;
    const resolved = !comment.resolved;
    comments = comments.map(item => item.id === comment.id ? { ...item, resolved } : item);
    persistComments();
    if (resolved) {
      addActivity('comment:resolved', { articleId: comment.articleId, articleTitle: comment.articleTitle, actor: currentUser.name, timestamp: new Date().toISOString() });
      emit('comment:resolved', { commentId: comment.id, articleId: comment.articleId, articleTitle: comment.articleTitle, actor: currentUser.name });
    }
  }

  function formatTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function typeLabel(type: string) {
    return type.replace('article:', 'Article · ').replace('media:', 'Media · ').replace('comment:', 'Comment · ').replace('auth:', 'Auth · ').replace(/_/g, ' ');
  }
</script>

<div class="workspace">
  <header class="hero">
    <div>
      <div class="eyebrow">COLLABORATION WORKSPACE</div>
      <h1>Discuss content. Resolve decisions.</h1>
      <p>Article discussions and a live CMS activity stream, connected through browser-level contracts.</p>
    </div>
    <div class="identity"><span class="avatar">{currentUser.name.slice(0, 1).toUpperCase()}</span><div><strong>{currentUser.name}</strong><small>{currentUser.role}</small></div></div>
  </header>

  {#if loading}
    <div class="state"><span class="spinner"></span><strong>Loading collaboration workspace…</strong></div>
  {:else if error}
    <div class="state error"><strong>Something went wrong</strong><p>{error}</p><button on:click={() => { error = ''; comments = readComments(); activities = readActivities(); articles = readArticles(); }}>Retry</button></div>
  {:else}
    <div class="toolbar">
      <button class:active={activityOpen} on:click={() => activityOpen = !activityOpen}>Activity <span>{activities.length}</span></button>
      <div class="toolbar-note">{articles.length} article{articles.length === 1 ? '' : 's'} · {comments.length} discussion{comments.length === 1 ? '' : 's'}</div>
    </div>

    <div class="layout">
      <aside class="articles panel">
        <div class="panel-head"><div><span class="eyebrow">EDITORIAL</span><h2>Articles</h2></div></div>
        {#if articles.length === 0}
          <div class="mini-state"><strong>No articles yet</strong><span>Create an article in Editorial to start a discussion.</span></div>
        {:else}
          {#each articles as article}
            <button class:selected={article.id === selectedArticleId} class="article" on:click={() => selectArticle(article.id)}>
              <span class="article-dot"></span><span><strong>{article.title}</strong><small>{article.author || 'Unknown author'} · {article.status || 'Draft'}</small></span>
            </button>
          {/each}
        {/if}
      </aside>

      <main class="discussion panel">
        {#if selectedArticle}
          <div class="discussion-head">
            <div><span class="eyebrow">ARTICLE DISCUSSION</span><h2>{selectedArticle.title}</h2><p>{selectedArticle.author || 'Unknown author'} · {selectedArticle.status || 'Draft'}</p></div>
            <span class="count">{articleComments.length} comment{articleComments.length === 1 ? '' : 's'}</span>
          </div>
          <div class="comments">
            {#if articleComments.length === 0}
              <div class="empty"><div class="empty-icon">◎</div><strong>No discussion yet</strong><span>Start a focused conversation about this article.</span></div>
            {:else}
              {#each articleComments as comment}
                <article class:resolved={comment.resolved} class="comment">
                  <div class="comment-avatar">{comment.author.slice(0, 1).toUpperCase()}</div>
                  <div class="comment-main">
                    <div class="comment-meta"><strong>{comment.author}</strong><span>{comment.role}</span><time>{formatTime(comment.createdAt)}</time>{#if comment.updatedAt}<em>edited</em>{/if}</div>
                    {#if editingId === comment.id}
                      <textarea bind:value={editingBody} rows="3"></textarea><div class="actions"><button on:click={() => saveEdit(comment)}>Save</button><button class="ghost" on:click={() => editingId = ''}>Cancel</button></div>
                    {:else}
                      <p class="body">{comment.body}</p>
                      {#if comment.mentions.length}<div class="mentions">Mentioned: {comment.mentions.map(name => `@${name}`).join(', ')}</div>{/if}
                      <div class="actions">
                        {#if canModerate(comment)}<button class="ghost" on:click={() => startEdit(comment)}>Edit</button><button class="ghost danger" on:click={() => deleteComment(comment)}>Delete</button><button class="ghost" on:click={() => toggleResolved(comment)}>{comment.resolved ? 'Reopen' : 'Resolve'}</button>{/if}
                      </div>
                    {/if}
                    {#if comment.resolved}<div class="resolved-label">✓ Discussion resolved</div>{/if}
                  </div>
                </article>
              {/each}
            {/if}
          </div>
          <div class="composer">
            <div class="composer-label">Comment on <strong>{selectedArticle.title}</strong></div>
            <div class="compose-wrap">
              <textarea value={newComment} on:input={(event) => updateMentionState((event.currentTarget as HTMLTextAreaElement).value)} on:keydown={(event) => event.key === 'Enter' && (event.metaKey || event.ctrlKey) && addComment()} placeholder="Add context, ask a question, or mention @someone…" rows="3"></textarea>
              {#if mentionOpen && mentionMatches.length}<div class="mentions-menu">{#each mentionMatches as user}<button on:click={() => chooseMention(user)}>@{user}</button>{/each}</div>{/if}
            </div>
            <div class="composer-footer"><span>Use <b>@name</b> to mention a teammate · Ctrl/Cmd + Enter to post</span><button on:click={addComment} disabled={!newComment.trim()}>Post comment</button></div>
          </div>
        {:else}
          <div class="empty"><div class="empty-icon">◌</div><strong>Select an article</strong><span>Choose an article to view its discussion.</span></div>
        {/if}
      </main>

      {#if activityOpen}
        <aside class="activity panel">
          <div class="panel-head"><div><span class="eyebrow">CMS EVENTS</span><h2>Activity</h2></div></div>
          <div class="filters">
            <select bind:value={activityArticle}><option value="All">All articles</option>{#each articles as article}<option value={article.id}>{article.title}</option>{/each}</select>
            <select bind:value={activityActor}><option value="All">All actors</option>{#each actors as actor}<option value={actor}>{actor}</option>{/each}</select>
            <select bind:value={activityType}><option value="All">All event types</option>{#each EVENT_TYPES as type}<option value={type}>{typeLabel(type)}</option>{/each}</select>
          </div>
          <div class="feed">
            {#if filteredActivities.length === 0}
              <div class="mini-state"><strong>No matching activity</strong><span>Events from Editorial, Auth, Media, and Collaboration will appear here.</span></div>
            {:else}
              {#each filteredActivities as item}
                <div class="feed-item"><span class="event-dot"></span><div><strong>{item.detail}</strong><small>{item.actor} · {formatTime(item.timestamp)}</small><label>{typeLabel(item.type)}</label></div></div>
              {/each}
            {/if}
          </div>
        </aside>
      {/if}
    </div>
  {/if}
</div>

<style>
  .workspace { max-width: 1440px; margin: 0 auto; padding: 2rem 2.5rem 4rem; color: var(--text-main); }
  .hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 2rem; padding: 1rem 0 2rem; border-bottom: 1px solid var(--border); }
  .eyebrow { display: block; color: var(--text-muted); font-size: .68rem; letter-spacing: .14em; font-weight: 800; margin-bottom: .45rem; }
  h1 { font-size: 2.25rem; letter-spacing: -.04em; margin: 0 0 .45rem; color: var(--primary); }
  h2 { margin: 0; font-size: 1.1rem; letter-spacing: -.02em; }
  .hero p { margin: 0; color: var(--text-muted); max-width: 680px; }
  .identity { display: flex; align-items: center; gap: .75rem; padding: .65rem .8rem; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-soft); min-width: 180px; }
  .identity strong, .identity small { display: block; }.identity small { color: var(--text-muted); margin-top: .15rem; }.avatar,.comment-avatar { display: grid; place-items: center; flex: 0 0 auto; border-radius: 11px; background: var(--primary-gradient); color: white; font-weight: 800; }
  .avatar { width: 36px; height: 36px; }.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; }.toolbar button,.composer button,.state button { border: 0; border-radius: 10px; padding: .65rem .9rem; background: var(--primary-gradient); color: white; font-weight: 700; cursor: pointer; }.toolbar button.active { box-shadow: 0 0 0 3px rgba(79,70,229,.12); }.toolbar button span { opacity: .75; margin-left: .35rem; }.toolbar-note { color: var(--text-muted); font-size: .8rem; }
  .layout { display: grid; grid-template-columns: 250px minmax(0,1fr) 360px; gap: 1rem; align-items: stretch; }.panel { background: white; border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow-sm); overflow: hidden; }.panel-head,.discussion-head { padding: 1.15rem 1.25rem; border-bottom: 1px solid var(--border); }.article { display: flex; gap: .7rem; width: 100%; text-align: left; border: 0; border-bottom: 1px solid var(--border); background: white; padding: 1rem 1.1rem; cursor: pointer; }.article.selected { background: #f5f3ff; }.article strong,.article small { display: block; }.article strong { font-size: .82rem; line-height: 1.35; }.article small { color: var(--text-muted); font-size: .68rem; margin-top: .3rem; }.article-dot,.event-dot { width: 7px; height: 7px; border-radius: 50%; background: #6366f1; margin-top: .4rem; flex: 0 0 auto; }.discussion { min-height: 700px; display: flex; flex-direction: column; }.discussion-head { display: flex; justify-content: space-between; gap: 1rem; }.discussion-head p { margin: .3rem 0 0; color: var(--text-muted); font-size: .75rem; }.count { align-self: center; font-size: .7rem; color: var(--text-muted); background: var(--bg-soft); border: 1px solid var(--border); padding: .4rem .6rem; border-radius: 999px; }.comments { padding: 1.25rem; flex: 1; overflow: auto; }.comment { display: flex; gap: .75rem; padding: 1rem 0; border-bottom: 1px solid var(--border); }.comment.resolved { opacity: .65; }.comment-avatar { width: 34px; height: 34px; font-size: .75rem; }.comment-main { min-width: 0; flex: 1; }.comment-meta { display: flex; align-items: center; gap: .45rem; flex-wrap: wrap; }.comment-meta strong { font-size: .78rem; }.comment-meta span,.comment-meta time,.comment-meta em { font-size: .65rem; color: var(--text-muted); }.comment-meta span { padding: .15rem .35rem; border-radius: 5px; background: var(--bg-soft); }.comment-meta em { font-style: normal; }.body { margin: .55rem 0; line-height: 1.55; font-size: .86rem; white-space: pre-wrap; }.mentions { color: var(--primary); font-size: .68rem; margin-bottom: .45rem; }.actions { display: flex; gap: .4rem; margin-top: .45rem; }.actions button { border: 0; background: transparent; color: var(--primary); cursor: pointer; font-size: .68rem; padding: .2rem .35rem; }.actions .danger { color: #dc2626; }.resolved-label { margin-top: .5rem; font-size: .67rem; color: #15803d; font-weight: 700; }.composer { padding: 1rem 1.25rem; border-top: 1px solid var(--border); background: var(--bg-soft); }.composer-label { font-size: .72rem; color: var(--text-muted); margin-bottom: .5rem; }.compose-wrap { position: relative; }.composer textarea,.comment textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border); border-radius: 10px; padding: .8rem; resize: vertical; font: inherit; color: var(--text-main); background: white; outline: none; }.composer textarea:focus,.comment textarea:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }.composer-footer { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-top: .6rem; }.composer-footer span { font-size: .65rem; color: var(--text-muted); }.composer button:disabled { opacity: .45; cursor: not-allowed; }.mentions-menu { position: absolute; left: 0; bottom: calc(100% + .35rem); background: white; border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-lg); padding: .3rem; min-width: 190px; z-index: 3; }.mentions-menu button { width: 100%; text-align: left; background: white; color: var(--text-main); box-shadow: none; }
  .activity { min-width: 0; }.filters { display: grid; gap: .45rem; padding: .8rem; border-bottom: 1px solid var(--border); }.filters select { width: 100%; border: 1px solid var(--border); background: white; border-radius: 8px; padding: .5rem; font-size: .7rem; color: var(--text-main); }.feed { max-height: 620px; overflow: auto; }.feed-item { display: flex; gap: .7rem; padding: .9rem; border-bottom: 1px solid var(--border); }.feed-item strong,.feed-item small,.feed-item label { display: block; }.feed-item strong { font-size: .72rem; line-height: 1.4; }.feed-item small { color: var(--text-muted); font-size: .62rem; margin-top: .25rem; }.feed-item label { display: inline-block; margin-top: .4rem; font-size: .58rem; color: var(--primary); background: #f5f3ff; padding: .2rem .35rem; border-radius: 4px; }.mini-state,.empty,.state { padding: 2rem; color: var(--text-muted); text-align: center; }.mini-state strong,.mini-state span,.empty strong,.empty span,.state strong,.state p { display: block; }.mini-state strong,.empty strong { color: var(--text-main); font-size: .8rem; }.mini-state span,.empty span { font-size: .7rem; margin-top: .3rem; line-height: 1.5; }.empty { margin: auto; }.empty-icon { font-size: 2rem; color: var(--primary); margin-bottom: .5rem; }.state { margin: 3rem auto; max-width: 500px; }.state.error { border: 1px solid #fecaca; border-radius: 14px; background: #fffafa; }.state p { font-size: .8rem; margin: .5rem 0 1rem; }.spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin .7s linear infinite; margin-bottom: .8rem; }@keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 1100px) { .layout { grid-template-columns: 220px minmax(0,1fr); }.activity { grid-column: 1 / -1; }.feed { max-height: 340px; }.hero { align-items: flex-start; flex-direction: column; }.identity { align-self: stretch; } }
  @media (max-width: 760px) { .workspace { padding: 1rem; }.layout { grid-template-columns: 1fr; }.articles { max-height: 260px; overflow: auto; }.discussion { min-height: 620px; }.activity { grid-column: auto; }h1 { font-size: 1.65rem; }.composer-footer { align-items: flex-start; flex-direction: column; }.composer-footer button { width: 100%; }.discussion-head { flex-direction: column; } }
</style>
