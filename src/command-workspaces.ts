export type CommandView='all'|'favorites'|'recent';
export type SearchableCommand={id:string;title:string;description:string;keywords?:string};
export function normalizeCommandIds(value:unknown,limit=20):string[]{
  if(!Array.isArray(value))return [];
  return [...new Set(value.filter((id):id is string=>typeof id==='string'&&id.length>0))].slice(0,limit);
}
/** Filter is read-only: never modifies persisted favorites, recent IDs or artwork. */
export function filterCommands<T extends SearchableCommand>(
  commands:readonly T[],query:string,view:CommandView,favorites:readonly string[],recent:readonly string[],
):T[]{
  const favoriteSet=new Set(favorites),recentSet=new Set(recent);
  const terms=query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
  const matching=commands.filter(command=>{
    if(view==='favorites'&&!favoriteSet.has(command.id))return false;
    if(view==='recent'&&!recentSet.has(command.id))return false;
    const haystack=[command.title,command.description,command.keywords??'']
      .join(' ').normalize('NFKC').toLocaleLowerCase();
    return terms.every(term=>haystack.includes(term));
  });
  if(terms.length)return matching;
  return matching.sort((a,b)=>{
    if(view==='recent')return recent.indexOf(a.id)-recent.indexOf(b.id);
    if(view==='favorites')return favorites.indexOf(a.id)-favorites.indexOf(b.id);
    const fav=Number(favoriteSet.has(b.id))-Number(favoriteSet.has(a.id));
    if(fav)return fav;
    const ai=recent.indexOf(a.id),bi=recent.indexOf(b.id);
    return (ai<0?100:ai)-(bi<0?100:bi);
  });
}
