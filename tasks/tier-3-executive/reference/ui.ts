interface Ticket { id: number; title: string; description: string; status: string; assignee: number | null; comments?: { id: number; body: string }[] }
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = (id: string) => element<HTMLFormElement>(id);
const message = (s: string) => { element('message').textContent = s; };
const api = async (url: string, method = 'GET', data?: unknown) => {
  const response = await fetch('/api/' + url, { method, headers: { 'content-type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
};
const values = (id: string) => Object.fromEntries(new FormData(form(id)).entries());
let selected: number | null = null;
const render = async () => {
  const tickets: Ticket[] = await api('tickets?q=' + encodeURIComponent(String(values('search').query ?? '')));
  element('tickets').replaceChildren(...tickets.map(t => {
    const li = document.createElement('li'), button = document.createElement('button'); button.textContent = t.title;
    button.onclick = () => void open(t.id).catch(e => message(e.message)); li.append(button); return li;
  }));
};
const open = async (id: number) => {
  const ticket: Ticket = await api('tickets/' + id); selected = id;
  const users: { id: number; email: string }[] = await api('users');
  const edit = form('edit');
  (edit.elements.namedItem('id') as HTMLInputElement).value = String(id);
  (edit.elements.namedItem('title') as HTMLInputElement).value = ticket.title;
  (edit.elements.namedItem('status') as HTMLSelectElement).value = ticket.status;
  const assignee = edit.elements.namedItem('assignee') as HTMLSelectElement;
  assignee.replaceChildren(new Option('Unassigned', ''), ...users.map(u => new Option(u.email, String(u.id))));
  assignee.value = ticket.assignee === null ? '' : String(ticket.assignee);
  element('comments').replaceChildren(...(ticket.comments ?? []).map(c => { const li = document.createElement('li'); li.textContent = c.body; return li; }));
  edit.hidden = false; form('comment').hidden = false;
};
const handle = (id: string, fn: (event: SubmitEvent) => Promise<void>) => form(id).addEventListener('submit', event => {
  event.preventDefault(); void fn(event).catch(e => message(e.message));
});
handle('account', async event => {
  const action = (event.submitter as HTMLButtonElement).value, data = values('account');
  await api(action, 'POST', data);
  if (action === 'signup') { message('Account created. Log in.'); return; }
  element('workspace').hidden = false; element('logout').hidden = false; form('account').hidden = true; message('Logged in'); await render();
});
element('logout').onclick = () => { void api('logout', 'POST', {}).then(() => { location.reload(); }).catch(e => message(e.message)); };
handle('create', async () => { const ticket = await api('tickets', 'POST', values('create')); form('create').reset(); await render(); await open(ticket.id); });
handle('search', render);
handle('edit', async () => {
  const data = values('edit'); await api('tickets/' + selected, 'PATCH', { title: data.title, status: data.status, ...(data.assignee ? { assignee: Number(data.assignee) } : {}) }); await render(); await open(selected!);
});
handle('comment', async () => { await api(`tickets/${selected}/comments`, 'POST', values('comment')); form('comment').reset(); await open(selected!); });
handle('import', async () => { await api('import', 'POST', values('import')); await render(); message('Import complete'); });
export {};
