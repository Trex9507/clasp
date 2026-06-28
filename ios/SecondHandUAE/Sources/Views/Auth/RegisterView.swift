import SwiftUI

struct RegisterView: View {
    @AppStorage("isLoggedIn") private var isLoggedIn = false
    @AppStorage("userId") private var userId = ""

    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var city = "dubai"
    @State private var isLoading = false
    @State private var errorMessage: String?

    let cities = [("dubai", "Dubai"), ("abu_dhabi", "Abu Dhabi")]

    var body: some View {
        Form {
            Section("Account") {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                SecureField("Password (min 6 chars)", text: $password)
                    .textContentType(.newPassword)
            }

            Section("Profile") {
                TextField("Name", text: $name)
                Picker("City", selection: $city) {
                    ForEach(cities, id: \.0) { c in
                        Text(c.1).tag(c.0)
                    }
                }
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }

            Section {
                Button {
                    register()
                } label: {
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Create Account")
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(email.isEmpty || password.count < 6 || name.isEmpty || isLoading)
            }
        }
        .navigationTitle("Register")
    }

    private func register() {
        isLoading = true
        errorMessage = nil
        Task {
            do {
                let response = try await APIClient.shared.register(
                    CreateUserRequest(email: email, password: password, name: name, city: city)
                )
                userId = response.user.id
                isLoggedIn = true
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}
