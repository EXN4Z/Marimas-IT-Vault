import TabBarang from './TabBarang';
import TabAset from './TabAset';

interface Props {
  search: string;
}

export default function TabStokMenipis({ search }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <TabBarang search={search} onlyMenipis />
      <TabAset search={search} onlyMenipis />
    </div>
  );
}