import {noteOrder, type Note} from './song';

export function noteIndex(notes: Note[]) {
  const ordered = [...notes].sort(noteOrder);
  let latest = 0;
  const ends = ordered.map(n => latest = Math.max(latest,n.startTick+n.durationTicks));
  return (start:number,end:number) => {
    let low=0, high=ends.length;
    while (low<high) {
      const mid=(low+high)>>>1;
      if (ends[mid]<start) low=mid+1;
      else high=mid;
    }
    const result: Note[] = [];
    for (let i=low;i<ordered.length && ordered[i].startTick<=end;i++) {
      const note=ordered[i];
      if (note.startTick+note.durationTicks>=start) result.push(note);
    }
    return result;
  };
}
