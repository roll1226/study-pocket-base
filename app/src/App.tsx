import type { AuthModel, RecordModel } from "pocketbase";
import { type FormEvent, useEffect, useState } from "react";
import "./App.css";
import pb from "./pocketbaseClient";

type TodoRecord = RecordModel & {
  title: string;
  user: string;
};

const parseError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function App() {
  const [currentUser, setCurrentUser] = useState<AuthModel | null>(
    pb.authStore.model
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [todos, setTodos] = useState<TodoRecord[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [todoError, setTodoError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [isCreatingTodo, setIsCreatingTodo] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [pendingTodoId, setPendingTodoId] = useState<string | null>(null);

  useEffect(() => {
    const remove = pb.authStore.onChange((_, model) => {
      setCurrentUser(model);
    });

    return () => {
      remove();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    if (!currentUser) {
      setTodos([]);
      return () => {
        isActive = false;
      };
    }

    setTodosLoading(true);
    setTodoError("");

    pb.collection("todos")
      .getFullList<TodoRecord>(200, {
        filter: `user="${currentUser.id}"`,
        sort: "-created",
      })
      .then((records) => {
        if (!isActive) {
          return;
        }
        setTodos(records);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }
        setTodoError(parseError(error, "TODOの取得に失敗しました。"));
      })
      .finally(() => {
        if (!isActive) {
          return;
        }
        setTodosLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [currentUser]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      await pb.collection("users").authWithPassword(email, password);
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
    } catch (error) {
      setAuthError(
        parseError(
          error,
          "ログインに失敗しました。メールアドレスとパスワードをご確認ください。"
        )
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = passwordConfirm.trim();

    if (trimmedEmail === "") {
      setAuthError("メールアドレスを入力してください。");
      return;
    }

    if (trimmedPassword === "" || trimmedConfirm === "") {
      setAuthError("パスワードを入力してください。");
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setAuthError("パスワードが一致しません。");
      return;
    }

    setAuthError("");
    setAuthLoading(true);

    try {
      await pb.collection("users").create({
        email: trimmedEmail,
        password: trimmedPassword,
        passwordConfirm: trimmedConfirm,
      });

      await pb
        .collection("users")
        .authWithPassword(trimmedEmail, trimmedPassword);

      setEmail("");
      setPassword("");
      setPasswordConfirm("");
    } catch (error) {
      setAuthError(
        parseError(error, "アカウント作成に失敗しました。再度お試しください。")
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    setTodos([]);
    setAuthError("");
    setTodoError("");
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setNewTitle("");
    setEditingId(null);
    setEditingTitle("");
    setPendingTodoId(null);
    setIsRegisterMode(false);
  };

  const toggleAuthMode = () => {
    if (authLoading) {
      return;
    }
    setIsRegisterMode((previous) => !previous);
    setAuthError("");
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
  };

  const handleCreateTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) {
      return;
    }

    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      return;
    }

    setIsCreatingTodo(true);
    setTodoError("");

    try {
      const record = await pb.collection("todos").create<TodoRecord>({
        title: trimmedTitle,
        user: currentUser.id,
      });
      setTodos((previous) => [record, ...previous]);
      setNewTitle("");
    } catch (error) {
      setTodoError(parseError(error, "TODOの追加に失敗しました。"));
    } finally {
      setIsCreatingTodo(false);
    }
  };

  const startEdit = (todo: TodoRecord) => {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
    setTodoError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) {
      return;
    }

    const trimmed = editingTitle.trim();
    if (!trimmed) {
      return;
    }

    setPendingTodoId(editingId);
    setTodoError("");

    try {
      const updated = await pb
        .collection("todos")
        .update<TodoRecord>(editingId, { title: trimmed });

      setTodos((previous) =>
        previous.map((todo) => (todo.id === updated.id ? updated : todo))
      );
      setEditingId(null);
      setEditingTitle("");
    } catch (error) {
      setTodoError(parseError(error, "TODOの更新に失敗しました。"));
    } finally {
      setPendingTodoId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setPendingTodoId(id);
    setTodoError("");

    try {
      await pb.collection("todos").delete(id);
      setTodos((previous) => previous.filter((todo) => todo.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setEditingTitle("");
      }
    } catch (error) {
      setTodoError(parseError(error, "TODOの削除に失敗しました。"));
    } finally {
      setPendingTodoId(null);
    }
  };

  return (
    <div className="app-root">
      {!currentUser ? (
        <div className="app-shell auth-shell">
          <h1 className="app-title">
            {isRegisterMode ? "新規アカウント作成" : "PocketBaseにログイン"}
          </h1>
          <p className="app-subtitle">
            {isRegisterMode
              ? "メールアドレスとパスワードを入力してアカウントを作成してください。"
              : "事前に作成済みのPocketBaseユーザーでログインしてください。"}
          </p>
          {authError && <div className="error-message">{authError}</div>}
          <form
            className="auth-form"
            onSubmit={isRegisterMode ? handleRegister : handleLogin}
          >
            <label className="form-field">
              <span>メールアドレス</span>
              <input
                className="input-field"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@example.com"
                required
              />
            </label>
            <label className="form-field">
              <span>パスワード</span>
              <input
                className="input-field"
                type="password"
                autoComplete={
                  isRegisterMode ? "new-password" : "current-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="パスワード"
                required
              />
            </label>
            {isRegisterMode && (
              <label className="form-field">
                <span>パスワード（確認）</span>
                <input
                  className="input-field"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  placeholder="パスワードを再入力"
                  required
                />
              </label>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={
                authLoading ||
                (isRegisterMode && password.trim() !== passwordConfirm.trim())
              }
            >
              {authLoading
                ? isRegisterMode
                  ? "作成中…"
                  : "認証中…"
                : isRegisterMode
                ? "アカウント作成"
                : "ログイン"}
            </button>
          </form>
          <div className="auth-toggle">
            <span>
              {isRegisterMode
                ? "既にアカウントをお持ちの場合はこちら"
                : "アカウントをお持ちでない場合はこちら"}
            </span>
            <button
              className="link-button"
              type="button"
              onClick={toggleAuthMode}
              disabled={authLoading}
            >
              {isRegisterMode ? "ログイン画面へ" : "新規アカウント作成"}
            </button>
          </div>
        </div>
      ) : (
        <div className="app-shell todo-shell">
          <header className="todo-header">
            <div>
              <h1 className="app-title">TODOボード</h1>
              <p className="app-subtitle">
                ログイン中: {currentUser.email ?? "ユーザー"}
              </p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={handleLogout}
            >
              ログアウト
            </button>
          </header>

          <section className="todo-section">
            <h2 className="section-title">TODOの追加</h2>
            <form className="todo-form" onSubmit={handleCreateTodo}>
              <input
                className="input-field"
                type="text"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="タイトルを入力"
                disabled={isCreatingTodo}
              />
              <button
                className="primary-button"
                type="submit"
                disabled={isCreatingTodo || !newTitle.trim()}
              >
                {isCreatingTodo ? "追加中…" : "追加"}
              </button>
            </form>
          </section>

          {todoError && <div className="error-message">{todoError}</div>}

          <section className="todo-section">
            <h2 className="section-title">あなたのTODO</h2>
            {todosLoading ? (
              <p className="info-message">読み込み中…</p>
            ) : todos.length === 0 ? (
              <p className="todo-empty">まだTODOは登録されていません。</p>
            ) : (
              <ul className="todo-items">
                {todos.map((todo) => (
                  <li key={todo.id} className="todo-item">
                    {editingId === todo.id ? (
                      <input
                        className="input-field todo-input"
                        type="text"
                        value={editingTitle}
                        onChange={(event) =>
                          setEditingTitle(event.target.value)
                        }
                        disabled={pendingTodoId === todo.id}
                      />
                    ) : (
                      <span className="todo-title">{todo.title}</span>
                    )}

                    <div className="todo-actions">
                      {editingId === todo.id ? (
                        <>
                          <button
                            className="primary-button"
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={
                              pendingTodoId === todo.id || !editingTitle.trim()
                            }
                          >
                            保存
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={cancelEdit}
                            disabled={pendingTodoId === todo.id}
                          >
                            キャンセル
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => startEdit(todo)}
                            disabled={pendingTodoId === todo.id}
                          >
                            編集
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => handleDelete(todo.id)}
                            disabled={pendingTodoId === todo.id}
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
