
export function RegisterForm() {
  return (
    <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
            <label className="floating-label">
                <span>Email</span>
                <input type="email" placeholder="Email" className="input input-md flex-1" />
            </label>
            <label className="floating-label">
                <span>Password</span>
                <input type="password" placeholder="Password" className="input input-md flex-1" />
            </label>
            <label className="floating-label">
                <span>Password confirmation</span>
                <input type="password" placeholder="Password confirmation" className="input input-md flex-1" />
            </label>
        </div>
        <button className="btn btn-neutral">Sign-in</button>
    </div>
  );
}
