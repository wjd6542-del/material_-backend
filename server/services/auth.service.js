import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendMail } from "../lib/mail.js";

export default {
  // 로그인
  async login(data) {
    const { username, password } = data;
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new AppError(
        "아이디 또는 비밀번호가 틀렸습니다.",
        400,
        "INVALID_USER",
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new AppError(
        "아이디 또는 비밀번호가 틀렸습니다.",
        400,
        "INVALID_USER",
      );
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    // 로그인 응답 결과
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
      },
    };
  },

  // 회원가입
  async signup(data) {
    const { name, username, email, password } = data;

    // 2. 중복 체크
    const existUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existUser) {
      throw new AppError("중복된 유저입니다.", 400, "INVALID_USER");
    }

    // USER 권한 조회
    const role = await prisma.role.findUnique({
      where: {
        name: "USER",
      },
    });

    // 3. 비밀번호 암호화
    const hash = await bcrypt.hash(password, 10);

    // 4. 회원 저장
    const user = await prisma.user.create({
      data: {
        username,
        password: hash,
        name,
        email,
        role_id: role.id,
      },
    });

    // 5. JWT 발급
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
      },
    };
  },

  // 회원 비밀번호 수정 처리
  async changePassword(userId, data) {
    const { password } = data;

    const hash = await bcrypt.hash(password, 10);

    try {
      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          password: hash,
        },
      });
    } catch (error) {
      throw new AppError("존재하지 않는 유저 입니다.", 400, "INVALID_USER");
    }

    return true;
  },

  // 이메일 인증 코드
  async sendCode(data) {
    const { email } = data;
    const timestamp = Date.now();

    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user)
      throw new AppError("존재하지 않는 유저 입니다.", 400, "INVALID_USER");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        code: String(timestamp),
      },
    });

    // 2. 메일로 인증코드 발송
    await sendMail({
      email,
      subject: "자재관리 시스템 알림",
      html: `
      <h3>${user.username} 님</h3>
      <p>발급된 코드로 인증후 비밀번호를 변경처리 하세요.</p>
	  <p>인증코드 : ${timestamp}</p>
    `,
    });

    console.log("응답 결과 확인!!");
    return true;
  },

  // 인증코드로 비밀번호 변경처리
  async codePasswordChange(data) {
    const { email, code, password } = data;
    const hash = await bcrypt.hash(password, 10);

    try {
      const user = await prisma.user.findFirst({
        where: { email: email, code: code },
      });

      if (!user)
        throw new AppError("존재하지 않는 유저 입니다.", 400, "INVALID_USER");

      // 코드 및 회원 계정으로 조회후 업데이트
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          password: hash,
        },
      });
      return true;
    } catch (error) {
      throw new AppError("존재하지 않는 유저 입니다.", 400, "INVALID_USER");
    }
  },
};
