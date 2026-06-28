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
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 6) {
                    Text("Create your account")
                        .font(.title2.bold())
                    Text("Start buying & selling in minutes")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 32)

                VStack(spacing: 16) {
                    fieldGroup(label: "Name") {
                        TextField("Your name", text: $name)
                            .textContentType(.name)
                    }

                    fieldGroup(label: "Email") {
                        TextField("your@email.com", text: $email)
                            .textContentType(.emailAddress)
                            .autocapitalization(.none)
                            .keyboardType(.emailAddress)
                    }

                    fieldGroup(label: "Password") {
                        SecureField("Min 6 characters", text: $password)
                            .textContentType(.newPassword)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("City").font(.caption.bold()).foregroundStyle(.secondary)
                        HStack(spacing: 10) {
                            ForEach(cities, id: \.0) { c in
                                Button {
                                    city = c.0
                                } label: {
                                    Text(c.1)
                                        .font(.subheadline.weight(.medium))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 12)
                                        .background(city == c.0 ? Color.primary : Color(.tertiarySystemFill))
                                        .foregroundStyle(city == c.0 ? Color(.systemBackground) : .primary)
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                            }
                        }
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button { register() } label: {
                    if isLoading {
                        ProgressView().tint(.white)
                    } else {
                        Text("Create Account")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(email.isEmpty || password.count < 6 || name.isEmpty || isLoading)
                .padding(.top, 8)

                Text("By creating an account, you agree to our Terms of Service and Privacy Policy.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 24)
        }
        .navigationTitle("Register")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func fieldGroup<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.caption.bold()).foregroundStyle(.secondary)
            content()
                .padding(14)
                .background(Color(.tertiarySystemFill))
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
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
