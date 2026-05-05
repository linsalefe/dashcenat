interface Props {
  titulo: string;
  sprint: number;
}

export function EmConstrucao({ titulo, sprint }: Props) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{titulo}</h1>
      <div className="rounded-lg border bg-white p-12 text-center text-muted-foreground">
        <p className="text-lg">Em construção</p>
        <p className="text-sm mt-2">Esta página será implementada na Sprint {sprint}.</p>
      </div>
    </div>
  );
}
