'use client';

import { useCallback, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { createTask, moveTask } from '@/lib/projects-api';
import type { BoardColumnDto, BoardResponse, BoardTaskDto, TaskDetail } from '@/lib/projects-api';

interface Props {
  board: BoardResponse;
  canMove: boolean;
  accessToken: string;
  projectId: string;
}

interface TaskState {
  columns: BoardColumnDto[];
}

const priorityColors: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-amber-400',
  LOW: 'text-sky-400',
};

function TaskCard({
  task,
  isDragging = false,
}: {
  task: BoardTaskDto;
  isDragging?: boolean;
}): JSX.Element {
  return (
    <div
      className={`rounded-lg border bg-white/[0.02] p-3 text-sm transition-shadow ${
        isDragging
          ? 'border-violet-500/60 shadow-lg shadow-violet-500/10 opacity-80'
          : 'border-white/8 hover:border-violet-500/30 hover:shadow-sm'
      }`}
    >
      <p className="font-medium leading-tight text-foreground">{task.title}</p>
      {task.assignee && (
        <p className="mt-1 text-xs text-ash">
          → {task.assignee.name ?? task.assignee.email}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`text-[11px] font-medium ${priorityColors[task.priority] ?? 'text-ash'}`}>
          {task.priority}
        </span>
        {task.dueDate && (
          <span className="text-[11px] text-ash">
            {new Intl.DateTimeFormat('pt-BR').format(new Date(task.dueDate))}
          </span>
        )}
        {task.subtaskCount > 0 && (
          <span className="text-[11px] text-ash">{task.subtaskCount} sub</span>
        )}
      </div>
    </div>
  );
}

function SortableTask({ task }: { task: BoardTaskDto }): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} />
    </div>
  );
}

export function KanbanBoard({ board, canMove, accessToken, projectId }: Props): JSX.Element {
  const [state, setState] = useState<TaskState>({ columns: board.columns });
  const [activeTask, setActiveTask] = useState<BoardTaskDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  // New task inline form
  const [addingToColId, setAddingToColId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [savingTask, setSavingTask] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as BoardTaskDto | undefined;
    if (task) setActiveTask(task);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null);
      if (!canMove) return;

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const taskId = active.id as string;
      const overId = over.id as string;

      // Find target column by checking which column the over item belongs to
      const sourceCol = state.columns.find((c) => c.tasks.some((t) => t.id === taskId));
      const targetCol =
        state.columns.find((c) => c.id === overId) ??
        state.columns.find((c) => c.tasks.some((t) => t.id === overId));

      if (!sourceCol || !targetCol || sourceCol.id === targetCol.id) return;

      // Optimistic update
      setState((prev) => {
        const taskToMove = prev.columns
          .flatMap((c) => c.tasks)
          .find((t) => t.id === taskId);
        if (!taskToMove) return prev;

        return {
          columns: prev.columns.map((col) => {
            if (col.id === sourceCol.id) {
              return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
            }
            if (col.id === targetCol.id) {
              const order = col.tasks.length;
              return {
                ...col,
                tasks: [...col.tasks, { ...taskToMove, order }],
              };
            }
            return col;
          }),
        };
      });

      try {
        const res = await moveTask(taskId, targetCol.id, targetCol.tasks.length, accessToken);
        if (!res.ok) {
          setError('Erro ao mover tarefa. Recarregue a página.');
          // Revert
          setState({ columns: board.columns });
        }
      } catch {
        setError('Erro de rede ao mover tarefa.');
        setState({ columns: board.columns });
      }
    },
    [canMove, state.columns, board.columns, accessToken],
  );

  async function handleAddTask(colId: string) {
    if (!newTaskTitle.trim()) return;
    setSavingTask(true);
    const res = await createTask(
      {
        projectId,
        columnId: colId,
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
      },
      accessToken,
    );
    setSavingTask(false);
    if (res.ok) {
      const task = res.data as TaskDetail;
      setState((prev) => ({
        columns: prev.columns.map((c) =>
          c.id === colId
            ? { ...c, tasks: [...c.tasks, task as unknown as BoardTaskDto], taskCount: c.taskCount + 1 }
            : c,
        ),
      }));
      setNewTaskTitle('');
      setAddingToColId(null);
    } else {
      setError('Erro ao criar tarefa.');
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-xs underline">
            Fechar
          </button>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {state.columns.map((col) => (
            <div
              key={col.id}
              className="flex w-72 shrink-0 flex-col rounded-xl border border-white/8 bg-white/[0.02]"
            >
              {/* Column header */}
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">{col.name}</h3>
                <div className="flex items-center gap-2">
                  {col.wipLimit && (
                    <span
                      className={`text-[11px] ${
                        col.overWipLimit ? 'text-red-400' : 'text-ash'
                      }`}
                    >
                      {col.taskCount}/{col.wipLimit}
                    </span>
                  )}
                  <span className="rounded-full border border-white/8 bg-background px-2 py-0.5 text-[11px] text-ash">
                    {col.taskCount}
                  </span>
                  {canMove && (
                    <button
                      type="button"
                      title="Nova tarefa nesta coluna"
                      onClick={() => {
                        setAddingToColId(col.id);
                        setNewTaskTitle('');
                        setNewTaskPriority('MEDIUM');
                      }}
                      className="rounded-md border border-white/8 bg-background px-1.5 py-0.5 text-[11px] text-ash hover:border-violet-500/40 hover:text-violet-300"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>

              {/* Tasks */}
              <div className="flex flex-col gap-2 p-3">
                <SortableContext
                  items={col.tasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {col.tasks.length === 0 ? (
                    <p className="rounded-md border border-dashed border-white/8 p-4 text-center text-xs text-ash">
                      Sem tarefas
                    </p>
                  ) : (
                    col.tasks.map((task) => (
                      <SortableTask key={task.id} task={task} />
                    ))
                  )}
                </SortableContext>

                {/* Inline new task form */}
                {addingToColId === col.id && (
                  <div className="mt-1 rounded-lg border border-violet-500/40 bg-white/[0.02] p-3 space-y-2">
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleAddTask(col.id);
                        if (e.key === 'Escape') setAddingToColId(null);
                      }}
                      placeholder="Título da tarefa…"
                      className="w-full rounded-md border border-white/8 bg-background px-2 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as any)}
                        className="flex-1 rounded-md border border-white/8 bg-background px-2 py-1 text-xs focus:outline-none"
                      >
                        <option value="LOW">Baixa</option>
                        <option value="MEDIUM">Média</option>
                        <option value="HIGH">Alta</option>
                        <option value="CRITICAL">Crítica</option>
                      </select>
                      <button
                        type="button"
                        disabled={savingTask || !newTaskTitle.trim()}
                        onClick={() => void handleAddTask(col.id)}
                        className="rounded-md bg-violet-600/80 px-3 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        {savingTask ? '…' : 'Criar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingToColId(null)}
                        className="rounded-md border border-white/8 px-2 py-1 text-xs text-ash"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      {!canMove && (
        <p className="mt-3 text-xs text-ash">
          Você tem acesso de leitura. Solicite <code>projects:tasks:assign</code> para mover tarefas.
        </p>
      )}
    </div>
  );
}
