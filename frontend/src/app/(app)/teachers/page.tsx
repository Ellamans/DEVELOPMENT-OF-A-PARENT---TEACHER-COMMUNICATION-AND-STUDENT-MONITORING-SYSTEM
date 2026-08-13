"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api-client";

interface ClassItem {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  assigned_class?: string;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [assigningTeacher, setAssigningTeacher] = useState<Teacher | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [managingTeacher, setManagingTeacher] = useState<Teacher | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teachersRes, classesRes] = await Promise.all([
        apiClient.get("/teachers?page=1&page_size=100"),
        apiClient.get("/school-setup/classes")
      ]);
      setTeachers(teachersRes.data || []);
      setClasses(classesRes.data || []);
    } catch (err) {
      console.error("Failed to load teachers or classes", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeacher = async () => {
    if (!assigningTeacher || !selectedClassId) return;
    try {
      await apiClient.post(`/school-setup/classes/${selectedClassId}/assign-teacher`, {
        teacher_id: assigningTeacher.id
      });
      alert("Teacher assigned to class successfully!");
      setAssigningTeacher(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Could not assign class teacher");
    }
  };

  const handleUpdateTeacher = async () => {
    if (!managingTeacher) return;
    try {
      await apiClient.put(`/teachers/${managingTeacher.id}`, {
        full_name: editName,
        phone: editPhone
      });
      alert("Teacher profile updated successfully!");
      setManagingTeacher(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update teacher profile");
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm("Are you sure you want to delete this teacher profile?")) return;
    try {
      await apiClient.delete(`/teachers/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete teacher");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teachers</h1>
        <p className="text-gray-500 text-sm">
          Manage teacher profiles, contact information, and class assignments.
        </p>
      </div>

      {loading ? (
        <p>Loading teachers...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                <th className="p-4">Name</th>
                <th className="p-4">Employee ID</th>
                <th className="p-4">Email</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Class Teacher Of</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">{t.full_name || "—"}</td>
                  <td className="p-4 text-gray-500">{t.employee_id}</td>
                  <td className="p-4 text-gray-500">{t.email || "—"}</td>
                  <td className="p-4 text-gray-500">{t.phone || "—"}</td>
                  <td className="p-4 text-gray-700 font-semibold">
                    {t.assigned_class ? (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {t.assigned_class}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Not assigned</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-green-600 font-medium capitalize">
                      {t.status || "Active"}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setAssigningTeacher(t);
                        setSelectedClassId("");
                      }}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Assign to Class
                    </button>
                    <button
                      onClick={() => {
                        setManagingTeacher(t);
                        setEditName(t.full_name);
                        setEditPhone(t.phone);
                      }}
                      className="text-gray-600 hover:underline text-xs font-medium"
                    >
                      Manage
                    </button>
                    <button
                      onClick={() => handleDeleteTeacher(t.id)}
                      className="text-red-600 hover:underline text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Assign Class */}
      {assigningTeacher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg max-w-md w-full space-y-4">
            <h3 className="font-bold text-lg">
              Assign Class for {assigningTeacher.full_name}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full border rounded p-2 text-sm"
              >
                <option value="">-- Choose Class --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setAssigningTeacher(null)}
                className="px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTeacher}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manage Teacher Profile */}
      {managingTeacher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg max-w-md w-full space-y-4">
            <h3 className="font-bold text-lg">Manage Teacher Profile</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border rounded p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full border rounded p-2 text-sm"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setManagingTeacher(null)}
                className="px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTeacher}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
