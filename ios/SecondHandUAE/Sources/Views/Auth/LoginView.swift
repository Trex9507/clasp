import SwiftUI

struct LoginView: View {
    @AppStorage("isLoggedIn") private var isLoggedIn = false
    @AppStorage("userId") private var userId = ""

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @FocusState private var focusedField: Field?

    private enum Field { case email, password }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 6) {
                    Text("Welcome back")
                        .font(.title2.bold())
                    Text("Log in to your account")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 32)

                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email").font(.caption.bold()).foregroundStyle(.secondary)
                        TextField("your@email.com", text: $email)
                            .textContentType(.emailAddress)
                            .autocapitalization(.none)
                            .keyboardType(.emailAddress)
                            .focused($focusedField, equals: .email)
                            .padding(14)
                            .background(Color(.tertiarySystemFill))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Password").font(.caption.bold()).foregroundStyle(.secondary)
                        SecureField("Enter password", text: $password)
                            .textContentType(.password)
                            .focused($focusedField, equals: .password)
                            .padding(14)
                            .background(Color(.tertiarySystemFill))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button { login() } label: {
                    if isLoading {
                        ProgressView().tint(.white)
                    } else {
                        Text("Log In")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(email.isEmpty || password.isEmpty || isLoading)
                .padding(.top, 8)
            }
            .padding(.horizontal, 24)
        }
        .navigationTitle("Log In")
        .navigationBarTitleDisplayMode(.inline)
        .onSubmit {
            switch focusedField {
            case .email: focusedField = .password
            case .password: login()
            case nil: break
            }
        }
    }

    private func login() {
        isLoading = true
        errorMessage = nil
        focusedField = nil
        Task {
            do {
                let response = try await APIClient.shared.login(email: email, password: password)
                userId = response.user.id
                isLoggedIn = true
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}
