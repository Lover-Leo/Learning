#define  _CRT_SECURE_NO_WARNINGS
#include<stdio.h>
//int main()
//{
////	int num1 = 0;
////	int num2 = 0;
////	scanf("%d %d", &num1, &num2);
////	int num3 = num1 + num2;
////	printf("%d\n",num3);
////	return 0;
//}
//尝试使用结构体打印学生名单
//struct stu
//{
//	char name[10];
//	char sex[10];
//	int id;
//};
//int main()
//{
//	struct stu s = { "suzhi","male",10 };
//	printf("%s %s %d\n",s.name,s.sex,s.id);
//	return 0;
//}
int main()
{
	int a = 0;
	scanf("%d", &a);
	if (a % 2 == 0)
		printf("Yes");
	else
		printf("No");
	return 0;
}
