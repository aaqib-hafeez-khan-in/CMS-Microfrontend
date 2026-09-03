import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';

type Status = 'Draft' | 'Review' | 'Published' | 'Archived';
type SortField = 'updatedAt' | 'title' | 'status' | 'author';

interface Revision {
  version: number;
  updatedAt: string;
  editor: string;
  summary: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  coverMediaReference: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  status: Status;
  tags: string[];
  categories: string[];
  revision: number;
  revisions: Revision[];
}

interface EditorState {
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  coverMediaReference: string;
  tags: string;
  categories: string;
}

const STORAGE_KEY = 'cms_articles';
const SESSION_KEY = 'cms_session';
const ARTICLE_EVENTS: Record<string, string> = {
  created: 'article:created',
  updated: 'article:updated',
  status: 'article:status_changed',
  published: 'article:published',
  deleted: 'article:deleted'
};

const emptyEditor: EditorState = {
  title: '',
  slug: '',
  body: '',
  excerpt: '',
  coverMediaReference: '',
  tags: '',
  categories: ''
};

function createId(): string {
  return `article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseList(value: string): string[] {
  return Array.from(new Set(value.split(',').map(item => item.trim()).filter(Boolean)));
}

function getSession(): { name: string; role: string } {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    const user = session.user || {};
    return {
      name: user.name || user.email || session.name || 'Current User',
      role: user.role || session.role || 'Contributor'
    };
  } catch {
    return { name: 'Current User', role: 'Contributor' };
  }
}

function normalizeArticle(raw: Partial<Article>, index: number): Article {
  const now = new Date().toISOString();
  const title = raw.title || 'Untitled article';
  const revision = raw.revision || 1;
  const status: Status = raw.status === 'Review' || raw.status === 'Published' || raw.status === 'Archived' ? raw.status : 'Draft';
  return {
    id: String(raw.id || `migrated-${Date.now()}-${index}`),
    title,
    slug: raw.slug || slugify(title),
    body: raw.body || raw.excerpt || '',
    excerpt: raw.excerpt || raw.body?.slice(0, 180) || '',
    coverMediaReference: raw.coverMediaReference || '',
    author: raw.author || 'Current User',
    createdAt: raw.createdAt || raw.updatedAt || now,
    updatedAt: raw.updatedAt || raw.date || now,
    status,
    tags: raw.tags || [],
    categories: raw.categories || [],
    revision,
    revisions: raw.revisions || [{ version: revision, updatedAt: raw.updatedAt || now, editor: raw.author || 'Current User', summary: 'Migrated from the previous article model' }]
  };
}

function readArticles(): Article[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const now = new Date().toISOString();
    const seed: Article = {
      id: 'article-1',
      title: 'Building Scalable Microfrontends',
      slug: 'building-scalable-microfrontends',
      body: 'Architectural patterns for modern web applications.',
      excerpt: 'Architectural patterns for modern web applications.',
      coverMediaReference: '',
      author: 'Admin',
      createdAt: '2026-04-10T09:00:00.000Z',
      updatedAt: '2026-04-10T09:00:00.000Z',
      status: 'Published',
      tags: ['architecture', 'microfrontends'],
      categories: ['Engineering'],
      revision: 1,
      revisions: [{ version: 1, updatedAt: now, editor: 'Admin', summary: 'Initial article' }]
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([seed]));
    return [seed];
  }
  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('Stored editorial data is invalid.');
  const normalized = parsed.map(normalizeArticle);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function emitArticleEvent(type: string, article: Article, previousStatus?: Status): void {
  const eventName = ARTICLE_EVENTS[type];
  if (!eventName) return;
  window.dispatchEvent(new CustomEvent(eventName, {
    detail: {
      articleId: article.id,
      title: article.title,
      status: article.status,
      previousStatus,
      author: article.author,
      updatedAt: article.updatedAt,
      revision: article.revision,
      source: 'cms-react-editorial'
    }
  }));
}

function can(role: string, permission: 'create' | 'edit' | 'review' | 'publish' | 'delete' | 'archive'): boolean {
  if (role === 'Administrator') return true;
  if (role === 'Editor') return true;
  return permission === 'create' || permission === 'edit';
}

export function EditorialApp(): React.ReactElement {
  const [articles, setArticles] = useState<Article[]>([]);
  const [view, setView] = useState<'list' | 'editor' | 'preview'>('list');
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [originalEditor, setOriginalEditor] = useState<EditorState>(emptyEditor);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [authorFilter, setAuthorFilter] = useState('All');
  const [tagFilter, setTagFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortAscending, setSortAscending] = useState(false);
  const [role, setRole] = useState('Contributor');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const session = getSession();
    setRole(session.role);
    try {
      setArticles(readArticles());
    } catch {
      setError('Editorial data could not be loaded. Stored data may be corrupted.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view !== 'editor') return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(editor) !== JSON.stringify(originalEditor)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [view, editor, originalEditor]);

  const authors = useMemo(() => Array.from(new Set(articles.map(article => article.author))).sort(), [articles]);
  const tags = useMemo(() => Array.from(new Set(articles.flatMap(article => article.tags))).sort(), [articles]);

  const filteredArticles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return articles.filter(article => {
      const matchesSearch = !query || [article.title, article.slug, article.excerpt, article.body, article.author, ...article.tags, ...article.categories].join(' ').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'All' || article.status === statusFilter;
      const matchesAuthor = authorFilter === 'All' || article.author === authorFilter;
      const matchesTag = tagFilter === 'All' || article.tags.includes(tagFilter) || article.categories.includes(tagFilter);
      return matchesSearch && matchesStatus && matchesAuthor && matchesTag;
    }).sort((a, b) => {
      const left = sortField === 'title' ? a.title : sortField === 'status' ? a.status : sortField === 'author' ? a.author : a.updatedAt;
      const right = sortField === 'title' ? b.title : sortField === 'status' ? b.status : sortField === 'author' ? b.author : b.updatedAt;
      return (left.localeCompare(right)) * (sortAscending ? 1 : -1);
    });
  }, [articles, search, statusFilter, authorFilter, tagFilter, sortField, sortAscending]);

  const persist = (next: Article[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setArticles(next);
      setError('');
    } catch {
      setError('Changes could not be saved. Browser storage may be unavailable or full.');
      throw new Error('Persistence failed');
    }
  };

  const toEditorState = (article: Article): EditorState => ({
    title: article.title,
    slug: article.slug,
    body: article.body,
    excerpt: article.excerpt,
    coverMediaReference: article.coverMediaReference,
    tags: article.tags.join(', '),
    categories: article.categories.join(', ')
  });

  const openEditor = (article?: Article) => {
    const next = article ? toEditorState(article) : emptyEditor;
    setActiveArticle(article || null);
    setEditor(next);
    setOriginalEditor(next);
    setMessage('');
    setError('');
    setView('editor');
  };

  const closeEditor = () => {
    if (JSON.stringify(editor) !== JSON.stringify(originalEditor)) {
      setConfirmAction(() => () => {
        setView('list');
        setActiveArticle(null);
        setMessage('Unsaved changes discarded.');
      });
      return;
    }
    setView('list');
    setActiveArticle(null);
  };

  const validateEditor = (): string => {
    if (!editor.title.trim()) return 'Title is required.';
    if (!editor.body.trim()) return 'Body content is required.';
    const slug = editor.slug.trim() || slugify(editor.title);
    const duplicate = articles.some(article => article.slug === slug && article.id !== activeArticle?.id);
    if (duplicate) return 'Slug must be unique.';
    return '';
  };

  const saveDraft = () => {
    const validation = validateEditor();
    if (validation) { setError(validation); return; }
    const now = new Date().toISOString();
    const session = getSession();
    const slug = editor.slug.trim() || slugify(editor.title);
    if (activeArticle) {
      const updated: Article = {
        ...activeArticle,
        title: editor.title.trim(),
        slug,
        body: editor.body,
        excerpt: editor.excerpt.trim() || editor.body.slice(0, 180),
        coverMediaReference: editor.coverMediaReference.trim(),
        tags: parseList(editor.tags),
        categories: parseList(editor.categories),
        updatedAt: now,
        revision: activeArticle.revision + 1,
        revisions: [...activeArticle.revisions, { version: activeArticle.revision + 1, updatedAt: now, editor: session.name, summary: 'Editorial content updated' }]
      };
      persist(articles.map(article => article.id === activeArticle.id ? updated : article));
      emitArticleEvent('updated', updated);
      setActiveArticle(updated);
      setOriginalEditor({ ...editor, slug });
      setEditor({ ...editor, slug });
      setMessage('Draft saved.');
    } else {
      const created: Article = {
        id: createId(),
        title: editor.title.trim(),
        slug,
        body: editor.body,
        excerpt: editor.excerpt.trim() || editor.body.slice(0, 180),
        coverMediaReference: editor.coverMediaReference.trim(),
        author: session.name,
        createdAt: now,
        updatedAt: now,
        status: 'Draft',
        tags: parseList(editor.tags),
        categories: parseList(editor.categories),
        revision: 1,
        revisions: [{ version: 1, updatedAt: now, editor: session.name, summary: 'Article created' }]
      };
      persist([created, ...articles]);
      emitArticleEvent('created', created);
      setActiveArticle(created);
      setOriginalEditor(toEditorState(created));
      setEditor(toEditorState(created));
      setMessage('Draft created.');
    }
    setError('');
  };

  const transition = (target: Status) => {
    if (!activeArticle) return;
    const current = activeArticle.status;
    const valid = (current === 'Draft' && target === 'Review') ||
      (current === 'Review' && (target === 'Draft' || target === 'Published')) ||
      (current === 'Published' && (target === 'Draft' || target === 'Archived')) ||
      (current === 'Archived' && target === 'Draft');
    if (!valid) { setError(`Cannot move ${current} to ${target}.`); return; }
    const permission = target === 'Review' ? 'review' : target === 'Published' ? 'publish' : target === 'Archived' ? 'archive' : 'edit';
    if (!can(role, permission)) { setError('Your role does not have permission for this workflow action.'); return; }
    const now = new Date().toISOString();
    const updated = { ...activeArticle, status: target, updatedAt: now, revision: activeArticle.revision + 1, revisions: [...activeArticle.revisions, { version: activeArticle.revision + 1, updatedAt: now, editor: getSession().name, summary: `Status changed from ${current} to ${target}` }] };
    persist(articles.map(article => article.id === updated.id ? updated : article));
    emitArticleEvent('status', updated, current);
    if (target === 'Published') emitArticleEvent('published', updated, current);
    setActiveArticle(updated);
    setMessage(target === 'Published' ? 'Article published.' : `Article moved to ${target}.`);
    setError('');
  };

  const deleteArticle = (article: Article) => {
    if (!can(role, 'delete')) { setError('Your role does not have permission to delete articles.'); return; }
    setConfirmAction(() => () => {
      persist(articles.filter(item => item.id !== article.id));
      emitArticleEvent('deleted', article);
      if (activeArticle?.id === article.id) { setView('list'); setActiveArticle(null); }
      setMessage('Article deleted.');
    });
  };

  const duplicateArticle = (article: Article) => {
    if (!can(role, 'create')) { setError('Your role does not have permission to create articles.'); return; }
    const now = new Date().toISOString();
    const duplicate: Article = {
      ...article,
      id: createId(),
      title: `${article.title} (Copy)`,
      slug: `${article.slug}-copy-${Date.now().toString().slice(-5)}`,
      status: 'Draft',
      author: getSession().name,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      revisions: [{ version: 1, updatedAt: now, editor: getSession().name, summary: `Duplicated from ${article.id}` }]
    };
    persist([duplicate, ...articles]);
    emitArticleEvent('created', duplicate);
    setMessage('Article duplicated as a new draft.');
  };

  const renderStatusActions = (article: Article) => {
    if (article.status === 'Draft') return <button onClick={() => { setActiveArticle(article); transition('Review'); }}>Submit for review</button>;
    if (article.status === 'Review') return <React.Fragment><button onClick={() => { setActiveArticle(article); transition('Published'); }}>Approve & publish</button><button onClick={() => { setActiveArticle(article); transition('Draft'); }}>Reject</button></React.Fragment>;
    if (article.status === 'Published') return <React.Fragment><button onClick={() => { setActiveArticle(article); transition('Draft'); }}>Unpublish</button><button onClick={() => { setActiveArticle(article); transition('Archived'); }}>Archive</button></React.Fragment>;
    return <button onClick={() => { setActiveArticle(article); transition('Draft'); }}>Restore</button>;
  };

  const openPreview = (article: Article) => {
    setActiveArticle(article);
    setView('preview');
  };

  const styles: React.CSSProperties = {
    display: 'grid',
    gap: '1rem'
  };

  return (
    <div className="animate-in">
      <style dangerouslySetInnerHTML={{ __html: `
        .editorial-toolbar { display:grid; grid-template-columns:2fr repeat(4, minmax(120px, 1fr)); gap:.75rem; margin-bottom:1.25rem; }
        .editorial-toolbar input,.editorial-toolbar select,.editor-form input,.editor-form textarea { width:100%; box-sizing:border-box; padding:.75rem; border:1px solid var(--border); border-radius:var(--radius); background:#fff; color:var(--text-main); }
        .editorial-toolbar input:focus,.editorial-toolbar select:focus,.editor-form input:focus,.editor-form textarea:focus { outline:2px solid var(--primary); outline-offset:1px; }
        .article-card { padding:1.25rem; border:1px solid var(--border); border-radius:var(--radius); background:var(--card-bg, #fff); box-shadow:var(--shadow-sm); }
        .article-actions { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
        .article-actions button,.editor-actions button { border:1px solid var(--border); border-radius:8px; padding:.55rem .8rem; background:#fff; color:var(--primary); cursor:pointer; font-weight:600; }
        .article-actions button:hover,.editor-actions button:hover { transform:translateY(-1px); }
        .primary-action { background:var(--primary-gradient) !important; color:#fff !important; border:none !important; }
        .danger-action { color:#dc2626 !important; }
        .status-badge { display:inline-flex; padding:.25rem .55rem; border-radius:999px; font-size:.75rem; font-weight:700; }
        .editor-form { max-width:960px; margin:0 auto; }
        .editor-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
        .editor-form label { display:grid; gap:.45rem; font-size:.8rem; font-weight:700; color:var(--text-muted); }
        .editor-form textarea { min-height:220px; resize:vertical; }
        .preview-body { white-space:pre-wrap; line-height:1.8; font-size:1.05rem; }
        .notice { padding:.8rem 1rem; border-radius:8px; margin-bottom:1rem; background:#eef2ff; color:#3730a3; }
        .error-notice { background:#fff1f2; color:#be123c; }
        .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.45); display:grid; place-items:center; z-index:1000; padding:1rem; }
        .modal { background:#fff; border-radius:14px; padding:1.5rem; max-width:420px; width:100%; box-shadow:0 20px 50px rgba(15,23,42,.2); }
        @media (max-width:900px) { .editorial-toolbar { grid-template-columns:1fr 1fr; } .editor-grid { grid-template-columns:1fr; } }
        @media (max-width:600px) { .editorial-toolbar { grid-template-columns:1fr; } .article-card > div { flex-direction:column !important; align-items:flex-start !important; } }
      `}} />

      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.04em', margin: 0 }}>Editorial Suite</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: 0 }}>Content lifecycle workspace · {role}</p>
        </div>
        {view === 'list' && <button className="primary-action" onClick={() => openEditor()} disabled={!can(role, 'create')} style={{ borderRadius: '10px', padding: '.8rem 1.25rem', cursor: 'pointer', fontWeight: 700 }}>+ Create Article</button>}
      </header>

      {message && <div className="notice" role="status">{message}</div>}
      {error && <div className="notice error-notice" role="alert">{error}</div>}

      {loading ? <div className="module-card" style={{ padding: '2rem' }} aria-live="polite">Loading editorial workspace…</div> : view === 'list' ? (
        <>
          <div className="editorial-toolbar">
            <input aria-label="Search articles" placeholder="Search title, body, tags, categories…" value={search} onChange={event => setSearch(event.target.value)} />
            <select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>All</option><option>Draft</option><option>Review</option><option>Published</option><option>Archived</option></select>
            <select aria-label="Filter by author" value={authorFilter} onChange={event => setAuthorFilter(event.target.value)}><option>All</option>{authors.map(author => <option key={author}>{author}</option>)}</select>
            <select aria-label="Filter by category or tag" value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option>All</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select>
            <div style={{ display: 'flex', gap: '.5rem' }}><select aria-label="Sort articles" value={sortField} onChange={event => setSortField(event.target.value as SortField)}><option value="updatedAt">Updated</option><option value="title">Title</option><option value="status">Status</option><option value="author">Author</option></select><button onClick={() => setSortAscending(value => !value)} aria-label="Toggle sort direction" style={{ border: '1px solid var(--border)', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>{sortAscending ? '↑' : '↓'}</button></div>
          </div>

          {filteredArticles.length === 0 ? <div className="module-card" style={{ padding: '2.5rem', textAlign: 'center' }}><h3>No articles found</h3><p style={{ color: 'var(--text-muted)' }}>{articles.length ? 'Try changing your search or filters.' : 'Create your first article to begin the editorial workflow.'}</p>{!articles.length && <button className="primary-action" onClick={() => openEditor()} disabled={!can(role, 'create')} style={{ padding: '.7rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Create Article</button>}</div> :
            <div style={styles}>
              {filteredArticles.map(article => <article className="article-card" key={article.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '.65rem', alignItems: 'center', flexWrap: 'wrap' }}><h3 style={{ margin: 0, color: 'var(--primary)' }}>{article.title}</h3><span className="status-badge" style={{ background: article.status === 'Published' ? '#ecfdf5' : article.status === 'Review' ? '#fff7ed' : article.status === 'Archived' ? '#f1f5f9' : '#eef2ff' }}>{article.status}</span></div>
                    <p style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{article.excerpt}</p>
                    <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>By {article.author} · Updated {new Date(article.updatedAt).toLocaleString()} · v{article.revision}</div>
                    <div style={{ marginTop: '.6rem', display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>{[...article.categories, ...article.tags].map(value => <span key={value} className="status-badge" style={{ background: '#f8fafc' }}>{value}</span>)}</div>
                  </div>
                  <div className="article-actions">
                    <button onClick={() => openPreview(article)}>Preview</button>
                    <button onClick={() => openEditor(article)} disabled={!can(role, 'edit')}>Edit</button>
                    <button onClick={() => duplicateArticle(article)}>Duplicate</button>
                    {renderStatusActions(article)}
                    <button className="danger-action" onClick={() => deleteArticle(article)}>Delete</button>
                  </div>
                </div>
              </article>)}
            </div>}
        </>
      ) : view === 'preview' && activeArticle ? (
        <section className="module-card" style={{ maxWidth: '900px', margin: '0 auto', padding: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}><span className="status-badge" style={{ background: '#eef2ff' }}>{activeArticle.status}</span><button onClick={() => setView('list')}>Back to articles</button></div>
          <h1 style={{ fontSize: '2.4rem', marginBottom: '.5rem' }}>{activeArticle.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{activeArticle.excerpt}</p>
          {activeArticle.coverMediaReference && <div style={{ margin: '1.5rem 0' }}><img src={activeArticle.coverMediaReference} alt={activeArticle.title} style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'cover', borderRadius: '12px' }} /></div>}
          <div className="preview-body">{activeArticle.body}</div>
          <hr style={{ margin: '2rem 0', border: 0, borderTop: '1px solid var(--border)' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>/{activeArticle.slug} · {activeArticle.author} · v{activeArticle.revision} · {new Date(activeArticle.updatedAt).toLocaleString()}</div>
          <div style={{ marginTop: '1rem' }}>{activeArticle.revisions.slice().reverse().map(revision => <div key={revision.version} style={{ fontSize: '.8rem', marginBottom: '.35rem' }}>v{revision.version} · {revision.editor} · {new Date(revision.updatedAt).toLocaleString()} · {revision.summary}</div>)}</div>
        </section>
      ) : (
        <section className="module-card editor-form" style={{ padding: '2rem', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}><div><h3 style={{ margin: 0 }}>{activeArticle ? 'Edit article' : 'Create article'}</h3><p style={{ margin: '.25rem 0 0', color: 'var(--text-muted)' }}>{activeArticle ? `Version ${activeArticle.revision}` : 'New draft'}</p></div><button onClick={closeEditor}>Back</button></div>
          <div className="editor-grid">
            <label>Title<input value={editor.title} onChange={event => setEditor({ ...editor, title: event.target.value })} placeholder="Article title" /></label>
            <label>Slug<input value={editor.slug} onChange={event => setEditor({ ...editor, slug: event.target.value })} placeholder="article-slug" /></label>
            <label>Excerpt<input value={editor.excerpt} onChange={event => setEditor({ ...editor, excerpt: event.target.value })} placeholder="Short summary" /></label>
            <label>Cover media reference<input value={editor.coverMediaReference} onChange={event => setEditor({ ...editor, coverMediaReference: event.target.value })} placeholder="Media URL or reference" /></label>
            <label>Tags<input value={editor.tags} onChange={event => setEditor({ ...editor, tags: event.target.value })} placeholder="cms, architecture" /></label>
            <label>Categories<input value={editor.categories} onChange={event => setEditor({ ...editor, categories: event.target.value })} placeholder="Engineering, Product" /></label>
          </div>
          <label style={{ marginTop: '1rem' }}>Body content<textarea value={editor.body} onChange={event => setEditor({ ...editor, body: event.target.value })} placeholder="Write the article…" /></label>
          <div className="editor-actions" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}><button onClick={saveDraft} disabled={!can(role, activeArticle ? 'edit' : 'create')}>Save draft</button>{activeArticle && activeArticle.status === 'Draft' && <button onClick={() => { saveDraft(); transition('Review'); }}>Submit for review</button>}<button onClick={() => activeArticle ? openPreview({ ...activeArticle, ...{ title: editor.title, body: editor.body, excerpt: editor.excerpt, slug: editor.slug || slugify(editor.title), tags: parseList(editor.tags), categories: parseList(editor.categories), coverMediaReference: editor.coverMediaReference } }) : setError('Save the draft before previewing it.')}>Preview</button></div>
            <button className="primary-action" onClick={saveDraft} disabled={!can(role, activeArticle ? 'edit' : 'create')}>Save changes</button>
          </div>
        </section>
      )}

      {confirmAction && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h3 id="confirm-title">Confirm action</h3><p>This action cannot be undone from this screen. Continue?</p><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem' }}><button onClick={() => setConfirmAction(null)}>Cancel</button><button className="danger-action" onClick={() => { const action = confirmAction; setConfirmAction(null); action(); }}>Confirm</button></div></div></div>}
    </div>
  );
}
