'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckSquare, Square, Plus, Trash2, ListTodo } from 'lucide-react';

interface TodoItem {
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
}

const STORAGE_KEY = 'realty-todo-checklist';

export function TodoChecklist() {
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [newTodo, setNewTodo] = useState('');
    const [mounted, setMounted] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setTodos(JSON.parse(stored));
            } catch {
                // Invalid JSON, start fresh
                setTodos([]);
            }
        }
    }, []);

    // Save to localStorage whenever todos change
    useEffect(() => {
        if (mounted) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
        }
    }, [todos, mounted]);

    const addTodo = useCallback(() => {
        const trimmed = newTodo.trim();
        if (!trimmed) return;

        const newItem: TodoItem = {
            id: crypto.randomUUID(),
            text: trimmed,
            completed: false,
            createdAt: Date.now(),
        };

        setTodos((prev) => [newItem, ...prev]);
        setNewTodo('');
    }, [newTodo]);

    const toggleTodo = useCallback((id: string) => {
        setTodos((prev) =>
            prev.map((todo) =>
                todo.id === id ? { ...todo, completed: !todo.completed } : todo
            )
        );
    }, []);

    const deleteTodo = useCallback((id: string) => {
        setTodos((prev) => prev.filter((todo) => todo.id !== id));
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTodo();
        }
    };

    const completedCount = todos.filter((t) => t.completed).length;
    const totalCount = todos.length;

    // Skeleton while loading from localStorage
    if (!mounted) {
        return (
            <Card>
                <CardHeader className='pb-3'>
                    <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                        <ListTodo className='size-5 text-primary' aria-hidden='true' />
                        To-Do Checklist
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className='h-40 flex items-center justify-center'>
                        <div className='animate-pulse text-muted-foreground text-sm'>
                            Loading…
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className='relative overflow-hidden'>
            <CardHeader className='pb-3'>
                <div className='flex items-center justify-between'>
                    <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                        <ListTodo className='size-5 text-primary' aria-hidden='true' />
                        To-Do Checklist
                    </CardTitle>
                    {totalCount > 0 && (
                        <span className='text-xs text-muted-foreground'>
                            {completedCount}/{totalCount} done
                        </span>
                    )}
                </div>
            </CardHeader>

            <CardContent className='space-y-4'>
                {/* Add new todo */}
                <div className='flex gap-2'>
                    <Input
                        type='text'
                        placeholder='Add a new task…'
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className='flex-1'
                        aria-label='New task'
                    />
                    <Button
                        onClick={addTodo}
                        size='icon'
                        disabled={!newTodo.trim()}
                        aria-label='Add task'
                    >
                        <Plus className='size-4' aria-hidden='true' />
                    </Button>
                </div>

                {/* Todo list */}
                <div className='space-y-2 max-h-64 overflow-y-auto'>
                    {todos.length === 0 ? (
                        <div className='flex flex-col items-center justify-center py-8 text-muted-foreground'>
                            <CheckSquare className='size-10 opacity-40 mb-2' aria-hidden='true' />
                            <p className='text-sm'>No tasks yet</p>
                            <p className='text-xs mt-1'>Add your first task above</p>
                        </div>
                    ) : (
                        todos.map((todo) => (
                            <div
                                key={todo.id}
                                className={`group flex items-center gap-3 p-3 rounded-lg border transition-all ${todo.completed
                                        ? 'bg-muted/30 border-muted'
                                        : 'bg-card border-border hover:border-primary/30 hover:shadow-sm'
                                    }`}
                            >
                                <button
                                    onClick={() => toggleTodo(todo.id)}
                                    className='shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded'
                                    aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
                                >
                                    {todo.completed ? (
                                        <CheckSquare className='size-5 text-primary' aria-hidden='true' />
                                    ) : (
                                        <Square className='size-5 text-muted-foreground hover:text-primary transition-colors' aria-hidden='true' />
                                    )}
                                </button>

                                <span
                                    className={`flex-1 text-sm transition-all ${todo.completed
                                            ? 'line-through text-muted-foreground'
                                            : 'text-foreground'
                                        }`}
                                >
                                    {todo.text}
                                </span>

                                <button
                                    onClick={() => deleteTodo(todo.id)}
                                    className='shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded p-1'
                                    aria-label='Delete task'
                                >
                                    <Trash2 className='size-4' aria-hidden='true' />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                    <div className='space-y-1'>
                        <div className='h-2 bg-muted rounded-full overflow-hidden'>
                            <div
                                className='h-full bg-gradient-to-r from-primary to-accent transition-all duration-300'
                                style={{ width: `${(completedCount / totalCount) * 100}%` }}
                                role='progressbar'
                                aria-valuenow={completedCount}
                                aria-valuemin={0}
                                aria-valuemax={totalCount}
                                aria-label='Task completion progress'
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
