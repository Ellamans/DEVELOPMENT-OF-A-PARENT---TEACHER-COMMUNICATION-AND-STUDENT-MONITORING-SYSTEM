"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

const registerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[a-z]/, "Must include a lowercase letter")
    .regex(/[0-9]/, "Must include a number")
    .regex(/[^A-Za-z0-9]/, "Must include a special character"),
  role: z.enum(["parent", "teacher", "student"]),
  class_id: z.string().optional(),
});
type RegisterForm = z.infer<typeof registerSchema>;

interface PublicClass {
  id: string;
  name: string;
  level: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classes, setClasses] = useState<PublicClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues: { role: "parent" } });

  const selectedRole = watch("role");

  // Classes are fetched fresh every time the teacher option is selected
  // (rather than once on page load) so a class an admin just created shows
  // up immediately, and one they just deleted disappears immediately too —
  // no stale list at the one moment it matters most.
  useEffect(() => {
    if (selectedRole !== "teacher") return;
    let cancelled = false;
    setClassesLoading(true);
    apiClient
      .get("/school-setup/classes/public")
      .then((res) => {
        if (!cancelled) setClasses(res?.data?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setClasses([]);
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRole]);

  async function onSubmit(values: RegisterForm) {
    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        // Never send an empty string as class_id — the backend expects a
        // real UUID or nothing at all.
        class_id: values.role === "teacher" && values.class_id ? values.class_id : undefined,
      };
      const res = await apiClient.post("/auth/register", payload);
      const message = res?.data?.message || "Account created!";
      if (values.role === "teacher") {
        toast.success(message, { duration: 8000 });
      } else {
        toast.success("Account created! Please sign in.");
      }
      router.push("/login");
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.response?.data?.detail;
      const passwordErrors = err?.response?.data?.detail?.password_errors;
      if (passwordErrors) {
        toast.error(passwordErrors.join(" "));
      } else {
        toast.error(typeof detail === "string" ? detail : "Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-text mb-1">Create your account</h1>
        <p className="text-sm text-text/60 mb-6">Parents, teachers, and students can sign up here.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1">First name</label>
              <input
                {...register("first_name")}
                className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {errors.first_name && <p className="text-sm text-red-500 mt-1">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Last name</label>
              <input
                {...register("last_name")}
                className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {errors.last_name && <p className="text-sm text-red-500 mt-1">{errors.last_name.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">I am a...</label>
            <select
              {...register("role")}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="parent">Parent</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
          </div>

          {selectedRole === "teacher" && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">Class you'll be in charge of</label>
              <select
                {...register("class_id")}
                disabled={classesLoading}
                className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              >
                <option value="">
                  {classesLoading ? "Loading classes..." : "Select a class (optional)"}
                </option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {!classesLoading && !classes.length && (
                <p className="text-xs text-text/40 mt-1">
                  No classes are set up yet — you can skip this and an admin will assign one.
                </p>
              )}
              <p className="text-xs text-text/50 mt-1">
                An admin will need to approve your account before you can sign in. Once approved, you'll
                automatically be the class teacher for the class you pick here — you can also change it later
                from your profile.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text mb-1">Email</label>
            <input
              type="email"
              {...register("email")}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Password</label>
            <input
              type="password"
              {...register("password")}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>}
            <p className="text-xs text-text/50 mt-1">8+ characters, with uppercase, lowercase, a number, and a symbol.</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>
        </form>

        <p className="text-sm text-text/60 text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
