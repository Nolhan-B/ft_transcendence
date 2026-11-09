export type MainTitleProps = {
  title: string;
};

export function MainTitle({ title }: MainTitleProps) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="divider"></div>
    </div>
  );
}
